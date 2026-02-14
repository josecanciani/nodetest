/**
 * @fileoverview Tests for file discovery and resolution utilities
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { findTestFiles, resolveTestFiles } from '../../src/utils/files.js';

describe('findTestFiles', () => {
    /** @type {string} */
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodetest-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return empty array for non-existent directory', () => {
        const result = findTestFiles('/nonexistent/path');
        assert.deepStrictEqual(result, []);
    });

    it('should return empty array for directory with no test files', () => {
        fs.writeFileSync(path.join(tmpDir, 'notATest.js'), '');
        const result = findTestFiles(tmpDir);
        assert.deepStrictEqual(result, []);
    });

    it('should find .test.js files', () => {
        fs.writeFileSync(path.join(tmpDir, 'example.test.js'), '');
        fs.writeFileSync(path.join(tmpDir, 'other.js'), '');

        const result = findTestFiles(tmpDir);
        assert.equal(result.length, 1);
        assert.ok(result[0].endsWith('example.test.js'));
    });

    it('should find .test.js files recursively', () => {
        const subDir = path.join(tmpDir, 'sub');
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(tmpDir, 'a.test.js'), '');
        fs.writeFileSync(path.join(subDir, 'b.test.js'), '');

        const result = findTestFiles(tmpDir);
        assert.equal(result.length, 2);
    });

    it('should return empty array for empty directory', () => {
        const result = findTestFiles(tmpDir);
        assert.deepStrictEqual(result, []);
    });
});

describe('resolveTestFiles', () => {
    /** @type {string} */
    let tmpDir;
    /** @type {string} */
    let originalCwd;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodetest-resolve-'));
        originalCwd = process.cwd();
        process.chdir(tmpDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should resolve files that exist at given path', () => {
        fs.writeFileSync(path.join(tmpDir, 'mytest.js'), '');
        const result = resolveTestFiles(['mytest.js']);
        assert.deepStrictEqual(result, ['mytest.js']);
    });

    it('should resolve files with tests/ prefix fallback', () => {
        const testsDir = path.join(tmpDir, 'tests');
        fs.mkdirSync(testsDir);
        fs.writeFileSync(path.join(testsDir, 'mytest.js'), '');

        const result = resolveTestFiles(['mytest.js']);
        assert.deepStrictEqual(result, ['tests/mytest.js']);
    });

    it('should throw for missing files', () => {
        assert.throws(
            () => resolveTestFiles(['nonexistent.js']),
            { message: /Test file\(s\) not found/ }
        );
    });
});
