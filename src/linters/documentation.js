/**
 * @fileoverview Linter to verify that all package.json scripts are documented in README.md
 */

import fs from 'fs';
import path from 'path';
import { CheckResult } from '../results.js';

/**
 * Runs documentation check
 * @param {import('../orchestrator/orchestrator.js').Orchestrator|string} [orchOrRoot='.'] - Orchestrator instance or project root path
 * @param {string} [pattern='npm run %s'] - Pattern (only if first arg is root path)
 * @param {string} [file='README.md'] - File (only if first arg is root path)
 * @returns {Promise<CheckResult>}
 */
export function runDocumentationCheck(orchOrRoot = '.', pattern = 'npm run %s', file = 'README.md') {
    let projectRoot = '.';
    let checkPattern = pattern;
    let checkFile = file;

    if (orchOrRoot && typeof orchOrRoot.getSettings === 'function') {
        const settings = orchOrRoot.getSettings();
        if (settings.linters && settings.linters.documentation) {
            if (settings.linters.documentation.pattern) checkPattern = settings.linters.documentation.pattern;
            if (settings.linters.documentation.file) checkFile = settings.linters.documentation.file;
        }
    } else if (typeof orchOrRoot === 'string') {
        projectRoot = orchOrRoot;
    }

    return new Promise((resolve) => {
        try {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const readmePath = path.join(projectRoot, checkFile);

            if (!fs.existsSync(packageJsonPath)) {
                return resolve(new CheckResult(
                    false,
                    'Documentation Check',
                    'package.json not found'
                ));
            }

            if (!fs.existsSync(readmePath)) {
                return resolve(new CheckResult(
                    false,
                    'Documentation Check',
                    `${checkFile} not found`
                ));
            }

            // Read package.json
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const scripts = Object.keys(packageJson.scripts || {}); // Use Object.keys to handle no scripts

            // Read README.md
            const readmeContent = fs.readFileSync(readmePath, 'utf8');

            const missingScripts = [];
            for (const scriptName of scripts) {
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
            }

            if (missingScripts.length > 0) {
                resolve(new CheckResult(
                    false,
                    'Documentation Check',
                    `The following scripts are not documented in ${checkFile}:\n${missingScripts.join('\n')}`
                ));
            } else {
                resolve(new CheckResult(
                    true,
                    'Documentation Check',
                    'All scripts documented.'
                ));
            }
        } catch (err) {
            resolve(new CheckResult(false, 'Documentation Check', err.message));
        }
    });
}
