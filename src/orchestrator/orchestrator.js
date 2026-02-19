/**
 * @module orchestrator
 * @fileoverview Test orchestrator - unified test runner with preTest checks,
 * cleanup phases, and signal handling.
 */

import { EventEmitter } from 'events';

import { mergeSettings, parseCliArgs } from '../settings/settings.js';
import { OrchestratorRunner } from './runner.js';

/**
 * @typedef {Object} OrchestratorRunResult
 * @property {number} exitCode - 0 for success, 1 for failure
 */

/**
 * Test orchestrator that coordinates linters, lifecycle events, and test execution.
 * @extends EventEmitter
 */
export class Orchestrator extends EventEmitter {
    /**
     * Creates a new Orchestrator with the given settings
     * @param {import('../settings/settings.js').OrchestratorSettings} [settings] - Configuration options
     */
    constructor(settings) {
        super();
        const resolved = mergeSettings(settings); // This merges with defaults
        /** @private */
        this._settings = resolved;

        /** @private */
        this._lintOnly = resolved.lintOnly;
        /** @private */
        this._forceClean = resolved.forceClean;
        /** @private */
        this._specificFiles = resolved.files;
        /** @private */
        this._parallelism = resolved.parallelism;
        /** @private */
        this._preTestCallbacks = [];
        /** @private */
        this._runner = new OrchestratorRunner(this);

        // Register built-in checks from settings as preTest callbacks
        const checks = resolved.checks || [];
        for (const check of checks) {
            this.addPreTest(check);
        }

        // Setup signal handlers
        this._runner.setupSignalHandlers();
    }

    /**
     * Creates an Orchestrator configured from CLI arguments (process.argv)
     * @param {string[]} [argv] - Arguments array, defaults to process.argv
     * @returns {Orchestrator}
     */
    static fromCLI(argv) {
        return new Orchestrator(parseCliArgs(argv));
    }

    /**
     * Adds a preTest callback (linters, server startup, etc.)
     * The callback receives the Orchestrator instance as its first argument,
     * allowing it to inspect settings like specificFiles or lintOnly.
     * @param {Function} callback - Async function(orchestrator) returning { success: boolean, label: string, output?: string }
     */
    addPreTest(callback) {
        this._preTestCallbacks.push(callback);
    }

    /**
     * Runs the full orchestrator lifecycle
     * @returns {Promise<OrchestratorRunResult>} Result with exitCode (0 = success, 1 = failure)
     */
    async run() {
        return this._runner.run(this._preTestCallbacks);
    }

    /**
     * Registers a shutdown handler that will be called on SIGTERM/SIGINT.
     * The callback receives the Orchestrator instance.
     * @param {Function} callback - Async function(orchestrator) for cleanup
     */
    onShutdown(callback) {
        this.on('shutdown', callback);
    }

    /**
     * Returns true if --force was passed, indicating forced cleanup is requested.
     * Use this in cleanUp event handlers.
     * @returns {boolean}
     */
    requiresForceClean() {
        return this._forceClean;
    }

    /**
     * Returns true if running specific test files (--files was passed).
     * Use this to skip expensive setup when running a subset of tests.
     * @returns {boolean}
     */
    isRunningSpecificFiles() {
        return this._specificFiles !== null && this._specificFiles.length > 0;
    }

    /**
     * Returns true if running in lint-only mode (--lint-only was passed).
     * @returns {boolean}
     */
    isLintOnly() {
        return this._lintOnly;
    }

    /**
     * Returns the specific test files to run, or null if running all tests.
     * @returns {string[]|null}
     */
    getSpecificFiles() {
        return this._specificFiles;
    }

    /**
     * Returns the parallelism setting (max concurrent preTest tasks).
     * @returns {number}
     */
    getParallelism() {
        return this._parallelism;
    }

    /**
     * Returns the complete settings object.
     * @returns {import('../settings/settings.js').OrchestratorSettings}
     */
    getSettings() {
        return this._settings;
    }
}
