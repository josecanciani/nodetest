/**
 * @module orchestrator/runner
 * @fileoverview Internal runner that executes the orchestrator lifecycle.
 * This module handles the actual test execution, logging, and signal handling.
 * It is not part of the public API.
 */

import { run } from 'node:test';
import { spec } from 'node:test/reporters';

import { findTestFiles } from '../utils/files.js';
import { ParallelRunner } from '../runner/parallelRunner.js';

/**
 * @typedef {Object} RunResult
 * @property {number} exitCode - 0 for success, 1 for failure
 */

/**
 * Internal runner that executes the orchestrator lifecycle.
 * Not exported publicly — users interact with Orchestrator only.
 */
export class OrchestratorRunner {
    /**
     * Creates a runner for the given orchestrator
     * @param {import('./orchestrator.js').Orchestrator} orchestrator
     */
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
        this.shutdownSignal = null;
    }

    /**
     * Sets up SIGTERM and SIGINT handlers for graceful shutdown
     */
    setupSignalHandlers() {
        const handleSignal = (signal) => {
            if (this.orchestrator.shutdownInProgress) return;
            this.orchestrator.shutdownInProgress = true;
            this.shutdownSignal = signal;
            console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
            this.emitAsync('shutdown').finally(() => {
                process.exit(1);
            });
        };

        process.on('SIGTERM', () => handleSignal('SIGTERM'));
        process.on('SIGINT', () => handleSignal('SIGINT'));
    }

    /**
     * Emits an async event, passing the orchestrator instance to all listeners.
     * @param {string} event - Event name
     * @returns {Promise<void>}
     */
    async emitAsync(event) {
        const listeners = this.orchestrator.listeners(event);
        await Promise.all(listeners.map(l => l(this.orchestrator)));
    }

    /**
     * Runs all preTest callbacks with concurrency-limited parallelism
     * @param {Function[]} callbacks - Array of preTest callback functions
     * @returns {Promise<{passed: boolean, results: Array}>}
     */
    async runPreTest(callbacks) {
        if (callbacks.length === 0) return { passed: true, results: [] };

        const runner = new ParallelRunner(this.orchestrator.getParallelism());
        const wrappedCallbacks = callbacks.map(cb => () => cb(this.orchestrator));
        const results = await runner.run(wrappedCallbacks);
        return { passed: results.every(r => r.success), results };
    }

    /**
     * Logs preTest results to console
     * @param {Array} results - Array of preTest results
     */
    logPreTestResults(results) {
        console.log('🔍 Pre-test check results:');
        for (const result of results) {
            if (result.success) {
                console.log(`  ✓ ${result.label} passed`);
            } else {
                console.log(`  ✗ ${result.label} failed:`);
                console.log(result.output);
            }
        }
    }

    /**
     * Runs the test suite using node:test runner
     * @param {string[]} testFiles - Array of test file paths
     * @returns {Promise<boolean>} True if all tests passed
     */
    async runTestSuite(testFiles) {
        console.log(`\n🧪 Running tests with ${this.orchestrator.getParallelism()} parallel runners...\n`);

        if (testFiles.length === 0) {
            console.log('  No test files found');
            return true;
        }

        return new Promise((resolve) => {
            const testStream = run({
                files: testFiles,
                concurrency: true
            }).compose(new spec());

            testStream.pipe(process.stdout);

            let passed = true;
            testStream.on('test:fail', () => {
                passed = false;
            });
            testStream.on('end', () => {
                resolve(passed);
            });
        });
    }

    /**
     * Runs the full orchestrator lifecycle
     * @param {Function[]} preTestCallbacks - Array of preTest callback functions
     * @returns {Promise<RunResult>} Result with exitCode (0 = success, 1 = failure)
     */
    async run(preTestCallbacks) {
        const orch = this.orchestrator;

        try {
            await this.emitAsync('init');

            console.log('🎯 Test Orchestrator\n');

            if (orch.isLintOnly()) {
                console.log('🔍 Running pre-test checks only...');
                const { passed, results } = await this.runPreTest(preTestCallbacks);
                this.logPreTestResults(results);
                if (passed) {
                    console.log('\n✅ All pre-test checks passed!');
                } else {
                    console.log('\n❌ Pre-test checks failed.');
                }
                return { exitCode: passed ? 0 : 1 };
            }

            // CleanUp phase - first, awaits listeners (interactive cleanup)
            console.log('🧹 Running cleanup phase...');
            await this.emitAsync('cleanUp');

            // Start finding test files async if no specific files given
            const testFilesPromise = orch.isRunningSpecificFiles()
                ? Promise.resolve(orch.getSpecificFiles())
                : Promise.resolve().then(() => findTestFiles('tests'));

            // Run preTest callbacks in parallel with test file discovery
            console.log('🔍 Running pre-test checks...');

            const [preTestResult, testFiles] = await Promise.all([
                this.runPreTest(preTestCallbacks),
                testFilesPromise
            ]);

            this.logPreTestResults(preTestResult.results);

            if (!preTestResult.passed) {
                console.log('\n❌ Pre-test checks failed. Aborting tests.');
                await this.emitAsync('afterTests');
                return { exitCode: 1 };
            }

            const testsPassed = await this.runTestSuite(testFiles);

            console.log('\n🧹 Post-test cleanup...');
            await this.emitAsync('afterTests');

            if (testsPassed) {
                console.log('\n✅ All tests passed!');
                return { exitCode: 0 };
            } else {
                console.log('\n❌ Some tests failed.');
                return { exitCode: 1 };
            }

        } catch (err) {
            console.error('Test Orchestrator found an error:', err);
            await this.emitAsync('afterTests');
            return { exitCode: 1 };
        }
    }

    /**
     * Returns the signal that triggered shutdown, or null if not shutting down.
     * @returns {string|null}
     */
    getShutdownSignal() {
        return this.shutdownSignal;
    }
}
