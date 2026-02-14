/**
 * @fileoverview Runs all built-in linters against the nodetest codebase itself
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runEslint } from '../../src/linters/eslint.js';
import { runJsdoc } from '../../src/linters/jsdoc.js';
import { runJsdocObjectTypeCheck } from '../../src/linters/jsdocObjectType.js';
import { runDocumentationCheck } from '../../src/linters/documentation.js';

describe('Linters on nodetest codebase', () => {
    it('ESLint should pass on src/ and tests/', async () => {
        const result = await runEslint(['src/', 'tests/']);
        assert.equal(result.success, true, `ESLint failed:\n${result.output}`);
    });

    it('JSDoc should pass on src/ and tests/', async () => {
        const result = await runJsdoc('jsdoc.json', ['src/', 'tests/']);
        assert.equal(result.success, true, `JSDoc failed:\n${result.output}`);
    });

    it('JSDoc Object type check should pass on src/', async () => {
        const result = await runJsdocObjectTypeCheck('src');
        assert.equal(result.success, true, `JSDoc Object type check failed:\n${result.output}`);
    });

    it('Documentation check should pass', async () => {
        const result = await runDocumentationCheck('.', 'npm');
        assert.equal(result.success, true, `Documentation check failed:\n${result.output}`);
    });
});
