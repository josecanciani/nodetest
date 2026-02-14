/**
 * @fileoverview JSDoc lint runner for test orchestrator
 */

import { spawn } from 'node:child_process';

/**
 * Runs JSDoc lint check
 * @param {string} [configFile='jsdoc.json'] - Path to JSDoc config file
 * @param {string[]} [dirs=['src/', 'tests/']] - Directories to lint
 * @returns {Promise<{success: boolean, output: string, label: string}>}
 */
export function runJsdoc(configFile = 'jsdoc.json', dirs = ['src/', 'tests/']) {
    return new Promise((resolve) => {
        const proc = spawn('npx', ['jsdoc', '-c', configFile, '--pedantic', '-d', '/tmp/jsdoc-out', ...dirs], {
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
            resolve({ success, output, label: 'JSDoc lint' });
        });
        proc.on('error', (err) => {
            resolve({ success: false, output: err.message, label: 'JSDoc lint' });
        });
    });
}
