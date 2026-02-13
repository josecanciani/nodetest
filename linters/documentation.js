/**
 * @fileoverview Linter to verify that all package.json scripts are documented in README.md
 */

import fs from 'fs';
import path from 'path';

/**
 * Runs documentation check
 * @param {string} [projectRoot='.'] - Path to project root
 * @param {string} [commandPrefix='./findx'] - Prefix used in README examples
 * @returns {Promise<{success: boolean, output: string, label: string}>}
 */
export function runDocumentationCheck(projectRoot = '.', commandPrefix = './findx') {
    return new Promise((resolve) => {
        try {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const readmePath = path.join(projectRoot, 'README.md');

            if (!fs.existsSync(packageJsonPath) || !fs.existsSync(readmePath)) {
                return resolve({
                    success: false,
                    output: 'package.json or README.md not found',
                    label: 'Documentation Check'
                });
            }

            // Read package.json
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const scripts = Object.keys(packageJson.scripts || {});

            // Read README.md
            const readmeContent = fs.readFileSync(readmePath, 'utf8');

            // Check each script
            const missingScripts = [];
            scripts.forEach(scriptName => {
                // Looking for the command string as it appears in the README table
                // Example: | `./findx build-base` | ...
                const expectedString = `${commandPrefix} ${scriptName}`;

                if (!readmeContent.includes(expectedString)) {
                    missingScripts.push(scriptName);
                }
            });

            if (missingScripts.length > 0) {
                resolve({
                    success: false,
                    output: `The following scripts are not documented in README.md:\n${missingScripts.join('\n')}`,
                    label: 'Documentation Check'
                });
            } else {
                resolve({
                    success: true,
                    output: 'All scripts documented.',
                    label: 'Documentation Check'
                });
            }
        } catch (err) {
            resolve({ success: false, output: err.message, label: 'Documentation Check' });
        }
    });
}
