/**
 * @module settings
 * @fileoverview Settings for the Orchestrator, including defaults and CLI parsing
 */

import { availableParallelism } from 'node:os';
import { runEslint } from '../linters/eslint.js';
import { runJsdoc } from '../linters/jsdoc.js';
import { runJsdocObjectTypeCheck } from '../linters/jsdocObjectType.js';
import { runDocumentationCheck } from '../linters/documentation.js';

/**
 * @typedef {Object} OrchestratorSettings
 * @property {boolean} [lintOnly] - Only run pre-test checks
 * @property {boolean} [forceClean] - Force cleanup phase
 * @property {string[]} [files] - Specific test files (null means auto-discover)
 * @property {number} [parallelism] - Max concurrent preTest tasks
 * @property {{pattern: string, file: string}} [documentation] - Documentation check settings
 * @property {string} [documentation.pattern] - Pattern for script command (e.g. 'npm run %s')
 * @property {string} [documentation.file] - Documentation file path (default: README.md)
 */

/** @type {Function[]} */
const DEFAULT_CHECKS = [
    () => runJsdoc(),
    () => runEslint(),
    () => runJsdocObjectTypeCheck(),
    (orch) => runDocumentationCheck(orch)
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
        checks: [...DEFAULT_CHECKS],
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
        checks: [...DEFAULT_CHECKS],
        linters: getDefaultSettings().linters
    };
}
