/**
 * @fileoverview Linter to verify that all package.json scripts are documented in README.md
 */

import fs from 'fs';
import path from 'path';

/**
 * Runs documentation check
 * @param {string} [projectRoot='.'] - Path to project root
 * @param {string} [pattern='npm run %s'] - Pattern to check in README (use %s for script name)
 * @param {string} [file='README.md'] - Documentation file to check
 * @returns {Promise<{success: boolean, output: string, label: string}>}
 */
export function runDocumentationCheck(projectRoot = '.', pattern = 'npm run %s', file = 'README.md') {
    return new Promise((resolve) => {
        try {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const readmePath = path.join(projectRoot, file);

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
                // Determine expected string based on pattern
                // Defaut pattern is 'npm run %s'
                let template = pattern || 'npm run %s';

                // Backwards compatibility: if pattern doesn't contain %s, treat it as a prefix
                if (!template.includes('%s')) {
                    template = `${template} %s`;
                }

                const expectedString = template.replace('%s', scriptName);

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
