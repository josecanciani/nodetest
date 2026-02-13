import { EventEmitter } from 'events';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import fs from 'fs';
import path from 'path';

import { runEslint } from './linters/eslint.js';
import { runJsdoc } from './linters/jsdoc.js';
import { runJsdocObjectTypeCheck } from './linters/jsdocObjectType.js';
import { runDocumentationCheck } from './linters/documentation.js';

export { runEslint, runJsdoc, runJsdocObjectTypeCheck, runDocumentationCheck };

export class Orchestrator extends EventEmitter {
    constructor() {
        super();
        this.lintOnly = process.argv.includes('--lint-only');
        this.forceClean = process.argv.includes('--force');
        this.specificFiles = this.parseFilesArg();
        this.preTestCallbacks = [];
        this.shutdownInProgress = false;

        // Register default linters as preTest callbacks
        this.addPreTest(runJsdoc);
        this.addPreTest(runEslint);
        this.addPreTest(runJsdocObjectTypeCheck);
        this.addPreTest(runDocumentationCheck);

        // Setup signal handlers
        this.setupSignalHandlers();
    }

    /**
     * Sets up SIGTERM and SIGINT handlers for graceful shutdown
     */
    setupSignalHandlers() {
        const handleSignal = (signal) => {
            if (this.shutdownInProgress) return;
            this.shutdownInProgress = true;
            console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
            this.emitAsync('shutdown', signal).finally(() => {
                process.exit(1);
            });
        };

        process.on('SIGTERM', () => handleSignal('SIGTERM'));
        process.on('SIGINT', () => handleSignal('SIGINT'));
    }

    /**
     * Parses --files argument to get specific test files
     * @returns {string[]|null} Array of file paths or null if not specified
     */
    parseFilesArg() {
        const filesIndex = process.argv.indexOf('--files');
        if (filesIndex === -1) {
            return null;
        }
        const files = process.argv.slice(filesIndex + 1).filter(arg => !arg.startsWith('--'));
        if (files.length === 0) {
            return null;
        }
        // Resolve paths relative to cwd if needed, or trust user input
        const resolvedFiles = files.map(f => {
             return fs.existsSync(f) ? f : (fs.existsSync(`tests/${f}`) ? `tests/${f}` : f);
        });

        const missing = resolvedFiles.filter(f => !fs.existsSync(f));
        if (missing.length > 0) {
            console.error('❌ Test file(s) not found:');
            for (const f of missing) {
                console.error(`   - ${f}`);
            }
            process.exit(1);
        }
        return resolvedFiles;
    }

    /**
     * Recursively finds all .test.js files in a directory
     * @param {string} dir - Directory to search
     * @returns {string[]} Array of file paths
     */
    findTestFiles(dir) {
        if (!fs.existsSync(dir)) return [];
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...this.findTestFiles(fullPath));
            } else if (entry.name.endsWith('.test.js')) {
                files.push(fullPath);
            }
        }
        return files;
    }

    /**
     * Adds a preTest callback (linters, server startup, etc.)
     * @param {Function} callback - Async function returning { success: boolean, label: string, output?: string }
     */
    addPreTest(callback) {
        this.preTestCallbacks.push(callback);
    }

    /**
     * Runs all preTest callbacks in parallel
     * @returns {Promise<{passed: boolean, results: Array}>}
     */
    async runPreTest() {
        if (this.preTestCallbacks.length === 0) return { passed: true, results: [] };

        const results = await Promise.all(this.preTestCallbacks.map(cb => cb()));
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

    async runTestSuite(testFiles) {
        const runners = availableParallelism();
        console.log(`\n🧪 Running tests with ${runners} parallel runners...\n`);

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

    async run() {
        try {
            this.emit('init');

            console.log('🎯 Test Orchestrator\n');

            if (this.lintOnly) {
                console.log('🔍 Running pre-test checks only...');
                const { passed, results } = await this.runPreTest();
                this.logPreTestResults(results);
                if (passed) {
                    console.log('\n✅ All pre-test checks passed!');
                    process.exit(0);
                } else {
                    console.log('\n❌ Pre-test checks failed.');
                    process.exit(1);
                }
            }

            // CleanUp phase - first, awaits listeners (interactive cleanup)
            console.log('🧹 Running cleanup phase...');
            await this.emitAsync('cleanUp', this.forceClean);

            // Start finding test files async if no specific files given
            const testFilesPromise = this.specificFiles
                ? Promise.resolve(this.specificFiles)
                : Promise.resolve().then(() => this.findTestFiles('tests'));

            // Run preTest callbacks in parallel with test file discovery
            console.log('🔍 Running pre-test checks...');

            const [preTestResult, testFiles] = await Promise.all([
                this.runPreTest(),
                testFilesPromise
            ]);

            this.logPreTestResults(preTestResult.results);

            if (!preTestResult.passed) {
                console.log('\n❌ Pre-test checks failed. Aborting tests.');
                await this.emitAsync('afterTests');
                process.exit(1);
            }

            const testsPassed = await this.runTestSuite(testFiles);

            console.log('\n🧹 Post-test cleanup...');
            await this.emitAsync('afterTests');

            if (testsPassed) {
                console.log('\n✅ All tests passed!');
                process.exit(0);
            } else {
                console.log('\n❌ Some tests failed.');
                process.exit(1);
            }

        } catch (err) {
            console.error('Test Orchestrator found an error:', err);
            await this.emitAsync('afterTests');
            process.exit(1);
        }
    }

    // Helper for async events
    async emitAsync(event, ...args) {
        const listeners = this.listeners(event);
        await Promise.all(listeners.map(l => l(...args)));
    }

    /**
     * Registers a shutdown handler that will be called on SIGTERM/SIGINT
     * @param {Function} callback - Async function called with signal name
     */
    onShutdown(callback) {
        this.on('shutdown', callback);
    }
}
