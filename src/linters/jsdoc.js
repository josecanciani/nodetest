/**
 * @fileoverview JSDoc lint runner for test orchestrator
 */

import { spawn } from 'node:child_process';
import { CheckResult } from '../results.js';

/**
 * Runs JSDoc lint check
 * @param {import('../orchestrator/orchestrator.js').Orchestrator|string} [orchOrConfig='jsdoc.json'] - Orchestrator or config file path
 * @param {string[]} [dirs=['src/', 'tests/']] - Directories to lint (only if first arg is string)
 * @returns {Promise<CheckResult>}
 */
export function runJsdoc(orchOrConfig = 'jsdoc.json', dirs = ['src/', 'tests/']) {
    let configFile = 'jsdoc.json';
    let lintDirs = ['src/', 'tests/'];

    if (orchOrConfig && typeof orchOrConfig.getSettings === 'function') {
        const settings = orchOrConfig.getSettings();
        // Assuming settings might have jsdoc config path, but current settings don't expose it standardly.
        // If users want custom config via settings, we would need to add it to settings schema.
        // For now, default to 'jsdoc.json' and 'src/', 'tests/'.
        // If we want to support custom dirs from settings, we can add settings.linters.jsdoc?
        if (settings.linters && settings.linters.jsdoc) {
            if (settings.linters.jsdoc.configFile) configFile = settings.linters.jsdoc.configFile;
            if (settings.linters.jsdoc.dirs) lintDirs = settings.linters.jsdoc.dirs;
        }
    } else if (typeof orchOrConfig === 'string') {
        configFile = orchOrConfig;
        lintDirs = dirs;
    }

    return new Promise((resolve) => {
        const proc = spawn('npx', ['jsdoc', '-c', configFile, '--pedantic', '-d', '/tmp/jsdoc-out', ...lintDirs], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env
        });
        let output = '';
        proc.stdout.on('data', (data) => {
            output += data.toString();
        });
        proc.stderr.on('data', (data) => {
            output += data.toString();
        });
        proc.on('close', (code) => {
            let success = code === 0;
            if (success && output.includes('ERROR:')) {
                success = false;
            }
            resolve(new CheckResult(success, 'JSDoc lint', output));
        });
        proc.on('error', (err) => {
            resolve(new CheckResult(false, 'JSDoc lint', err.message));
        });
    });
}
