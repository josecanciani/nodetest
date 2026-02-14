/**
 * @fileoverview ESLint runner for test orchestrator
 */

import { spawn } from 'node:child_process';

/**
 * Runs ESLint check
 * @param {string[]} [dirs=['src/', 'tests/']] - Directories to lint
 * @returns {Promise<{success: boolean, output: string, label: string}>}
 */
export function runEslint(dirs = ['src/', 'tests/']) {
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
            resolve({ success: code === 0, output, label: 'ESLint' });
        });
        proc.on('error', (err) => {
            resolve({ success: false, output: err.message, label: 'ESLint' });
        });
    });
}
