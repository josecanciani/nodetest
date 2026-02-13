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
        this.linters = [];
        
        // Register default linters
        this.on('init', () => {
            this.addLinter(runJsdoc);
            this.addLinter(runEslint);
            this.addLinter(runJsdocObjectTypeCheck);
            this.addLinter(runDocumentationCheck);
        });
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

    addLinter(linterFn) {
        this.linters.push(linterFn);
    }

    async runLintChecks() {
        if (this.linters.length === 0) return { passed: true, results: [] };

        const results = await Promise.all(this.linters.map(l => l()));
        return { passed: results.every(r => r.success), results };
    }

    logLintResults(results) {
        console.log('🔍 Lint check results:');
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
                console.log('🔍 Running lint checks only...');
                const { passed, results } = await this.runLintChecks();
                this.logLintResults(results);
                if (passed) {
                    console.log('\n✅ All lint checks passed!');
                    process.exit(0);
                } else {
                    console.log('\n❌ Lint checks failed.');
                    process.exit(1);
                }
            }

            // Hook for cleanup before everything
            await this.emitAsync('preTestCleanup', this.forceClean);

            // Parallel execution of Lints and Server/DB setup
            // If specific files are requested, we might skip some setups, but that's up to the listeners
            // to decide based on this.specificFiles
            
            console.log('🔍 Running lint checks and setup...');
            
            const lintPromise = this.runLintChecks();
            const setupPromise = this.emitAsync('beforeTests', this.specificFiles);
            
            const [lintResult, _] = await Promise.all([lintPromise, setupPromise]);
            
            this.logLintResults(lintResult.results);

            if (!lintResult.passed) {
                console.log('\n❌ Lint checks failed. Aborting tests.');
                await this.emitAsync('afterTests'); // Cleanup
                process.exit(1);
            }

            const files = this.specificFiles || this.findTestFiles('tests');
            const testsPassed = await this.runTestSuite(files);

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
}