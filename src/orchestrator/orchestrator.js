/**
 * @module orchestrator
 * @fileoverview Test orchestrator - unified test runner with preTest checks,
 * cleanup phases, and signal handling.
 */

import { EventEmitter } from 'events';

import { mergeSettings, parseCliArgs } from '../settings/settings.js';
import { OrchestratorRunner } from './runner.js';
import { runJsdoc } from '../linters/jsdoc.js';
import { runEslint } from '../linters/eslint.js';
import { runJsdocObjectTypeCheck } from '../linters/jsdocObjectType.js';
import { runDocumentationCheck } from '../linters/documentation.js';

/** @type {Map<string, Function>} */
const BUILTIN_CHECKS = new Map([
    ['jsdoc', runJsdoc],
    ['eslint', runEslint],
    ['jsdocObjectType', runJsdocObjectTypeCheck],
    ['documentation', runDocumentationCheck]
]);

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
            if (typeof check === 'string') {
                const checkFn = BUILTIN_CHECKS.get(check);
                if (checkFn) {
                    this.addPreCheck(checkFn);
                } else {
                    console.warn(`Warning: Unknown check '${check}' specified in settings.`);
                }
            } else if (typeof check === 'function') {
                this.addPreCheck(check);
            }
        }

        // Setup signal handlers
        this._runner.setupSignalHandlers();
    }

    /**
     * Creates an Orchestrator configured from CLI arguments (process.argv)
     * @param {string[]} [argv] - Arguments array, defaults to process.argv
     * @param {import('../settings/settings.js').OrchestratorSettings} [overrides] - Optional settings overrides
     * @returns {Orchestrator}
     */
    static fromCLI(argv, overrides = {}) {
        const cliSettings = parseCliArgs(argv);

        // Start with CLI settings (which include defaults)
        const merged = { ...cliSettings };

        // Apply overrides only if CLI didn't explicitly set them (assuming defaults are "falsy" or specific values)
        // Since parseCliArgs returns defaults when flags are missing, we can't distinguish explicit vs default easily without re-parsing or logic.
        // But for boolean flags: false is default. If CLI is false, we can take override.
        // If CLI is true, we keep it (CLI wins).
        if (!merged.lintOnly && overrides.lintOnly) merged.lintOnly = true;
        if (!merged.forceClean && overrides.forceClean) merged.forceClean = true;

        // For files: CLI default is null.
        if (merged.files === null && overrides.files) merged.files = overrides.files;

        // For checks: CLI `checks` is DEFAULT_CHECKS.
        // If overrides provides checks, we should prefer overrides UNLESS there's a way to specify checks via CLI (there isn't currently).
        // So overrides should win for checks.
        if (overrides.checks) merged.checks = overrides.checks;

        // For linters: Merge deep
        if (overrides.linters) {
            merged.linters = { ...merged.linters, ...overrides.linters };
        }

        // For parallelism: CLI default is availableParallelism().
        // If override specifies it, use it? CLI arg doesn't support parallelism yet in parseCliArgs.
        if (overrides.parallelism) merged.parallelism = overrides.parallelism;

        return new Orchestrator(merged);
    }

    /**
     * Adds a preTest check.
     * @param {Function} callback - Async function(orchestrator) returning CheckResult
     */
    addPreCheck(callback) {
        this._preTestCallbacks.push(callback);
    }

    /**
     * @deprecated Use addPreCheck instead
     * @param {Function} callback
     */
    addPreTest(callback) {
        this.addPreCheck(callback);
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
