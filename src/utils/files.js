/**
 * @module utils/files
 * @fileoverview File discovery and path resolution utilities
 */

import fs from 'fs';
import path from 'path';

/**
 * Recursively finds all .test.js files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of file paths
 */
export function findTestFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findTestFiles(fullPath));
        } else if (entry.name.endsWith('.test.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Parses a list of file paths, resolving them relative to cwd or a tests/ prefix
 * @param {string[]} files - Array of file path strings
 * @returns {string[]} Array of resolved file paths
 * @throws {Error} If any file is not found
 */
export function resolveTestFiles(files) {
    const resolvedFiles = files.map(f => {
        return fs.existsSync(f) ? f : (fs.existsSync(`tests/${f}`) ? `tests/${f}` : f);
    });

    const missing = resolvedFiles.filter(f => !fs.existsSync(f));
    if (missing.length > 0) {
        const details = missing.map(f => `   - ${f}`).join('\n');
        throw new Error(`Test file(s) not found:\n${details}`);
    }
    return resolvedFiles;
}
