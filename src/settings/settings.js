/**
 * @module settings
 * @fileoverview Settings for the Orchestrator, including defaults and CLI parsing
 */

import { availableParallelism } from 'node:os';

/**
 * @typedef {Object} CheckResult
 * @property {boolean} success - Whether the check passed
 * @property {string} label - Display label for the check
 * @property {string} [output] - Optional error output or details
 */

/**
 * @typedef {Object} OrchestratorSettings
 * @property {boolean} [lintOnly] - Only run pre-test checks
 * @property {boolean} [forceClean] - Force cleanup phase
 * @property {string[]} [files] - Specific test files (null means auto-discover)
 * @property {number} [parallelism] - Max concurrent preTest tasks
 * @property {string[]} [checks] - Names of built-in checks to run (e.g. ['jsdoc', 'eslint'])
 * @property {LintersConfig} [linters] - Configuration for linters/checks
 */

/**
 * @typedef {Object} DocumentationConfig
 * @property {string} [pattern] - Pattern for script command (e.g. 'npm run %s')
 * @property {string} [file] - Documentation file path (default: README.md)
 */

/**
 * @typedef {Object} LintersConfig
 * @property {DocumentationConfig} [documentation] - Documentation check settings
 */

/** @type {string[]} */
const DEFAULT_CHECK_NAMES = [
    'jsdoc',
    'eslint',
    'jsdocObjectType',
    'documentation'
];

/**
 * Returns the default settings for the Orchestrator
 * @returns {OrchestratorSettings}
 */
export function getDefaultSettings() {
    return {
        lintOnly: false,
        forceClean: false,
        files: null,
        parallelism: availableParallelism(),
        checks: [...DEFAULT_CHECK_NAMES],
        linters: {
            documentation: {
                pattern: 'npm run %s',
                file: 'README.md'
            }
        }
    };
}

/**
 * Merges user-provided settings with defaults
 * @param {OrchestratorSettings} [userSettings] - Partial settings to override defaults
 * @returns {OrchestratorSettings} Complete settings with defaults applied
 */
export function mergeSettings(userSettings) {
    const defaults = getDefaultSettings();
    if (!userSettings) return defaults;

    return {
        lintOnly: userSettings.lintOnly ?? defaults.lintOnly,
        forceClean: userSettings.forceClean ?? defaults.forceClean,
        files: userSettings.files !== undefined ? userSettings.files : defaults.files,
        parallelism: userSettings.parallelism ?? defaults.parallelism,
        checks: userSettings.checks !== undefined ? userSettings.checks : defaults.checks,
        linters: { ...defaults.linters, ...(userSettings.linters || {}) }
    };
}

/**
 * Parses process.argv to build an OrchestratorSettings object
 * @param {string[]} [argv] - Arguments array, defaults to process.argv
 * @returns {OrchestratorSettings} Settings parsed from CLI arguments
 */
export function parseCliArgs(argv) {
    const args = argv ?? process.argv;
    const lintOnly = args.includes('--lint-only');
    const forceClean = args.includes('--force');

    let files = null;
    const filesIndex = args.indexOf('--files');
    if (filesIndex !== -1) {
        const fileArgs = args.slice(filesIndex + 1).filter(arg => !arg.startsWith('--'));
        if (fileArgs.length > 0) {
            files = fileArgs;
        }
    }

    return {
        lintOnly,
        forceClean,
        files,
        parallelism: availableParallelism(),
        checks: [...DEFAULT_CHECK_NAMES],
        linters: getDefaultSettings().linters
    };
}
