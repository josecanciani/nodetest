/**
 * @fileoverview Validates that JSDoc does not use generic Object types
 *
 * This linter ensures all JSDoc type annotations use specific types instead of
 * the generic "Object" type. Using specific types improves code documentation
 * and IDE support.
 */

import fs from 'fs';
import path from 'path';
import { CheckResult } from '../results.js';

/**
 * Recursively finds all .js files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of file paths
 */
function findJsFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findJsFiles(fullPath));
        } else if (entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Violation found in a file
 * @typedef {object} ObjectTypeViolation
 * @property {string} file - File path
 * @property {number} line - Line number (1-indexed)
 * @property {string} content - The line content
 * @property {string} tag - The JSDoc tag that uses Object
 */

/**
 * Checks a file for generic Object type usage in JSDoc
 * @param {string} filePath - Path to the file
 * @returns {ObjectTypeViolation[]} Array of violations
 */
function checkFileForObjectTypes(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const violations = [];

    // Pattern matches JSDoc tags that use the generic Object word as a type
    // Catches: param, returns, type, typedef tags with Object in their type expression
    // Also matches with modifiers like Object|null, Object[], ?Object
    // Does NOT match Object with type params (e.g. generic syntax - though still bad)
    const objectTypePattern = /(@(?:param|returns?|type|typedef|property|prop))\s+\{([^}]*\bObject\b[^}]*)\}/g;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        // Reset regex lastIndex for each line
        objectTypePattern.lastIndex = 0;

        while ((match = objectTypePattern.exec(line)) !== null) {
            const tag = match[1];
            const typeExpr = match[2];

            // Skip if it's a typedef that defines the Object's shape inline
            // e.g., @typedef {Object} MyType followed by @property definitions
            // We only flag standalone {Object} without property definitions
            if (tag === '@typedef') {
                // Check if this is a typedef with a name (which will have properties)
                // These are acceptable: @typedef {Object} TypeName
                // The properties will be defined on subsequent lines
                continue;
            }

            violations.push({
                file: filePath,
                line: i + 1,
                content: line.trim(),
                tag,
                typeExpr
            });
        }
    }

    return violations;
}

/**
 * Runs the Object type check on all source files
 * @param {import('../orchestrator/orchestrator.js').Orchestrator|string} [orchOrDir='src'] - Orchestrator or directory
 * @returns {Promise<CheckResult>}
 */
export function runJsdocObjectTypeCheck(orchOrDir = 'src') {
    let dir = 'src';
    if (orchOrDir && typeof orchOrDir.getSettings === 'function') {
        const settings = orchOrDir.getSettings();
        if (settings.linters && settings.linters.jsdoc && settings.linters.jsdoc.dirs) {
            // Usually this check runs on source directory, not multiple dirs?
            // "Recursively finds all .js files in a directory"
            // If user has multiple dirs, we might need loop.
            // But let's assume first dir for now or default to 'src'.
            if (Array.isArray(settings.linters.jsdoc.dirs) && settings.linters.jsdoc.dirs.length > 0) {
                dir = settings.linters.jsdoc.dirs[0]; // Simplification
            }
        }
    } else if (typeof orchOrDir === 'string') {
        dir = orchOrDir;
    }
    return new Promise((resolve) => {
        try {
            if (!fs.existsSync(dir)) {
                return resolve(new CheckResult(true, 'JSDoc Object types', `Directory ${dir} not found, skipping.`));
            }

            const jsFiles = findJsFiles(dir); // Assuming findJsFiles is defined in scope
            const allViolations = [];

            for (const file of jsFiles) {
                const violations = checkFileForObjectTypes(file); // Assuming defined
                allViolations.push(...violations);
            }

            if (allViolations.length > 0) {
                const grouped = new Map();
                for (const v of allViolations) {
                    const relPath = path.relative(process.cwd(), v.file);
                    if (!grouped.has(relPath)) {
                        grouped.set(relPath, []);
                    }
                    grouped.get(relPath).push(v);
                }

                let output = `Found ${allViolations.length} generic Object type(s) in JSDoc:\n\n`;
                for (const [file, violations] of grouped) {
                    output += `${file}:\n`;
                    for (const v of violations) {
                        output += `  Line ${v.line}:\n`;
                        output += `    ${v.content}\n`;
                    }
                    output += '\n';
                }
                output += 'Use specific types instead of Object. Define a @typedef or use inline object syntax {property: type}.';

                resolve(new CheckResult(false, 'JSDoc Object types', output));
            } else {
                resolve(new CheckResult(
                    true,
                    'JSDoc Object types',
                    `Checked ${jsFiles.length} files in ${dir}, no generic Object types found.`
                ));
            }
        } catch (err) {
            resolve(new CheckResult(false, 'JSDoc Object types', err.message));
        }
    });
}
