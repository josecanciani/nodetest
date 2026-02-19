/**
 * @fileoverview Tests for the settings module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultSettings, mergeSettings, parseCliArgs } from '../../src/settings/settings.js';

describe('getDefaultSettings', () => {
    it('should return default values', () => {
        const settings = getDefaultSettings();
        assert.equal(settings.lintOnly, false);
        assert.equal(settings.forceClean, false);
        assert.equal(settings.files, null);
        assert.equal(typeof settings.parallelism, 'number');
        assert.ok(settings.parallelism > 0);
        assert.equal(settings.checks.length, 4);
    });

    it('should return a new checks array each time', () => {
        const a = getDefaultSettings();
        const b = getDefaultSettings();
        assert.notStrictEqual(a.checks, b.checks);
    });
});

describe('mergeSettings', () => {
    it('should return defaults when called with no argument', () => {
        const settings = mergeSettings();
        assert.equal(settings.lintOnly, false);
        assert.equal(settings.forceClean, false);
        assert.equal(settings.files, null);
        assert.equal(settings.checks.length, 4);
    });

    it('should override lintOnly', () => {
        const settings = mergeSettings({ lintOnly: true });
        assert.equal(settings.lintOnly, true);
        assert.equal(settings.forceClean, false);
    });

    it('should override forceClean', () => {
        const settings = mergeSettings({ forceClean: true });
        assert.equal(settings.forceClean, true);
    });

    it('should override files', () => {
        const settings = mergeSettings({ files: ['a.test.js'] });
        assert.deepStrictEqual(settings.files, ['a.test.js']);
    });

    it('should override parallelism', () => {
        const settings = mergeSettings({ parallelism: 2 });
        assert.equal(settings.parallelism, 2);
    });

    it('should override checks with empty array', () => {
        const settings = mergeSettings({ checks: [] });
        assert.deepStrictEqual(settings.checks, []);
    });

    it('should override checks with custom array', () => {
        const customCheck = 'custom-check';
        const settings = mergeSettings({ checks: [customCheck] });
        assert.equal(settings.checks.length, 1);
        assert.equal(settings.checks[0], customCheck);
    });

    it('should keep defaults for properties not provided', () => {
        const settings = mergeSettings({ lintOnly: true });
        assert.equal(settings.files, null);
        assert.equal(settings.checks.length, 4);
        assert.ok(settings.parallelism > 0);
    });
});

describe('parseCliArgs', () => {
    it('should parse --lint-only flag', () => {
        const settings = parseCliArgs(['node', 'test.js', '--lint-only']);
        assert.equal(settings.lintOnly, true);
    });

    it('should parse --force flag', () => {
        const settings = parseCliArgs(['node', 'test.js', '--force']);
        assert.equal(settings.forceClean, true);
    });

    it('should parse --files with file paths', () => {
        const settings = parseCliArgs(['node', 'test.js', '--files', 'a.test.js', 'b.test.js']);
        assert.deepStrictEqual(settings.files, ['a.test.js', 'b.test.js']);
    });

    it('should set files to null when --files is not present', () => {
        const settings = parseCliArgs(['node', 'test.js']);
        assert.equal(settings.files, null);
    });

    it('should set files to null when --files has no arguments', () => {
        const settings = parseCliArgs(['node', 'test.js', '--files']);
        assert.equal(settings.files, null);
    });

    it('should stop collecting files at next flag', () => {
        const settings = parseCliArgs(['node', 'test.js', '--files', 'a.test.js', '--force']);
        assert.deepStrictEqual(settings.files, ['a.test.js']);
        assert.equal(settings.forceClean, true);
    });

    it('should return defaults for flags not present', () => {
        const settings = parseCliArgs(['node', 'test.js']);
        assert.equal(settings.lintOnly, false);
        assert.equal(settings.forceClean, false);
        assert.equal(settings.files, null);
        assert.equal(settings.checks.length, 4);
    });
});
