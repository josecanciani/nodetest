/**
 * @fileoverview ESLint runner for test orchestrator
 */

import { spawn } from 'node:child_process';
import { CheckResult } from '../results.js';

/**
 * Runs ESLint check
 * @param {import('../orchestrator/orchestrator.js').Orchestrator|string[]} [orchOrDirs=['src/', 'tests/']] - Orchestrator or directories
 * @returns {Promise<CheckResult>}
 */
export function runEslint(orchOrDirs = ['src/', 'tests/']) {
    let dirs = ['src/', 'tests/'];

    // Check if first argument is Orchestrator
    // We check for getSettings method to identify Orchestrator
    if (orchOrDirs && typeof orchOrDirs.getSettings === 'function') {
        // Could extract settings here if needed, but eslint usually just runs on standard dirs
        // If we added config for dirs in settings, we would use it here.
        // For now, stick to default dirs or potentially look for settings.
        // settings.linters.eslint.dirs?
        const settings = orchOrDirs.getSettings();
        if (settings.linters && settings.linters.eslint && settings.linters.eslint.dirs) {
            dirs = settings.linters.eslint.dirs;
        }
    } else if (Array.isArray(orchOrDirs)) {
        dirs = orchOrDirs;
    }

    return new Promise((resolve) => {
        const proc = spawn('npx', ['eslint', ...dirs], {
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
            resolve(new CheckResult(code === 0, 'ESLint', output));
        });
        proc.on('error', (err) => {
            resolve(new CheckResult(false, 'ESLint', err.message));
        });
    });
}
