/**
 * @fileoverview Linter to verify that all package.json scripts are documented in README.md
 */

import fs from 'fs';
import path from 'path';

/**
 * Runs documentation check
 * @param {import('../orchestrator/orchestrator.js').Orchestrator|string} [orchOrRoot='.'] - Orchestrator instance or project root path
 * @param {string} [pattern] - Pattern (only if first arg is root path)
 * @param {string} [file] - File (only if first arg is root path)
 * @returns {Promise<{success: boolean, output: string, label: string}>}
 */
export function runDocumentationCheck(orchOrRoot = '.', pattern, file) {
    let projectRoot = '.';
    let checkPattern = 'npm run %s';
    let checkFile = 'README.md';

    // Check if first argument is an Orchestrator instance
    if (orchOrRoot && typeof orchOrRoot.getSettings === 'function') {
        const settings = orchOrRoot.getSettings();
        if (settings.linters && settings.linters.documentation) {
            checkPattern = settings.linters.documentation.pattern || checkPattern;
            checkFile = settings.linters.documentation.file || checkFile;
        }
        // Assuming project root is current directory when running via orchestrator
    } else {
        projectRoot = orchOrRoot;
        checkPattern = pattern || checkPattern;
        checkFile = file || checkFile;
    }

    return new Promise((resolve) => {
        try {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const readmePath = path.join(projectRoot, checkFile);

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
                let template = checkPattern;

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
