/**
 * @fileoverview Tests for the Orchestrator class (public API only)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Orchestrator } from '../../src/orchestrator/orchestrator.js';

describe('Orchestrator', () => {
    describe('constructor', () => {
        it('should create orchestrator with default settings', () => {
            const orchestrator = new Orchestrator();
            assert.equal(orchestrator.isLintOnly(), false);
            assert.equal(orchestrator.requiresForceClean(), false);
            assert.equal(orchestrator.isRunningSpecificFiles(), false);
        });

        it('should apply lintOnly setting', () => {
            const orchestrator = new Orchestrator({ lintOnly: true, linters: [] });
            assert.equal(orchestrator.isLintOnly(), true);
        });

        it('should apply forceClean setting', () => {
            const orchestrator = new Orchestrator({ forceClean: true, linters: [] });
            assert.equal(orchestrator.requiresForceClean(), true);
        });

        it('should apply files setting', () => {
            const orchestrator = new Orchestrator({ files: ['a.js'], linters: [] });
            assert.equal(orchestrator.isRunningSpecificFiles(), true);
        });
    });

    describe('fromCLI', () => {
        it('should parse --lint-only from CLI args', () => {
            const orchestrator = Orchestrator.fromCLI(['node', 'test.js', '--lint-only']);
            assert.equal(orchestrator.isLintOnly(), true);
        });

        it('should parse --files from CLI args', () => {
            const orchestrator = Orchestrator.fromCLI(['node', 'test.js', '--files', 'a.test.js']);
            assert.equal(orchestrator.isRunningSpecificFiles(), true);
        });

        it('should parse --force from CLI args', () => {
            const orchestrator = Orchestrator.fromCLI(['node', 'test.js', '--force']);
            assert.equal(orchestrator.requiresForceClean(), true);
        });

        it('should accept overrides', () => {
            const orchestrator = Orchestrator.fromCLI(['node', 'test.js'], { lintOnly: true });
            assert.equal(orchestrator.isLintOnly(), true);
        });

        it('should prioritize CLI args over overrides', () => {
            // CLI says --lint-only (true), override says lintOnly: false. CLI wins?
            // "if overrides.checks) merged.checks = overrides.checks"
            // "const merged = { ...overrides, ...cliSettings };"
            // cliSettings has lintOnly: true.
            // merged has lintOnly: true.
            // So CLI wins.
            const orchestrator = Orchestrator.fromCLI(['node', 'test.js', '--lint-only'], { lintOnly: false });
            assert.equal(orchestrator.isLintOnly(), true);
        });
    });

    describe('helper methods', () => {
        it('requiresForceClean should return correct value', () => {
            const orch1 = new Orchestrator({ forceClean: true, checks: [] });
            const orch2 = new Orchestrator({ forceClean: false, checks: [] });
            assert.equal(orch1.requiresForceClean(), true);
            assert.equal(orch2.requiresForceClean(), false);
        });

        it('isRunningSpecificFiles should return true when files are specified', () => {
            const orch1 = new Orchestrator({ files: ['a.js'], checks: [] });
            const orch2 = new Orchestrator({ files: null, checks: [] });
            const orch3 = new Orchestrator({ files: [], checks: [] });
            assert.equal(orch1.isRunningSpecificFiles(), true);
            assert.equal(orch2.isRunningSpecificFiles(), false);
            assert.equal(orch3.isRunningSpecificFiles(), false);
        });

        it('isLintOnly should return correct value', () => {
            const orch1 = new Orchestrator({ lintOnly: true, checks: [] });
            const orch2 = new Orchestrator({ lintOnly: false, checks: [] });
            assert.equal(orch1.isLintOnly(), true);
            assert.equal(orch2.isLintOnly(), false);
        });
    });

    describe('onShutdown', () => {
        it('should register a shutdown listener', () => {
            const orchestrator = new Orchestrator({ checks: [] });
            const cb = async () => { };
            orchestrator.onShutdown(cb);
            assert.equal(orchestrator.listenerCount('shutdown'), 1);
        });
    });

    describe('run', () => {
        it('should return exitCode 0 when lintOnly and all preTests pass', async () => {
            const orchestrator = new Orchestrator({ lintOnly: true, checks: [] });
            orchestrator.addPreCheck(async () => ({ success: true, label: 'lint' }));

            const result = await orchestrator.run();
            assert.equal(result.exitCode, 0);
        });

        it('should return exitCode 1 when lintOnly and a preTest fails', async () => {
            const orchestrator = new Orchestrator({ lintOnly: true, checks: [] });
            orchestrator.addPreCheck(async () => ({ success: false, label: 'lint', output: 'fail' }));

            const result = await orchestrator.run();
            assert.equal(result.exitCode, 1);
        });

        it('should emit init event on run', async () => {
            const orchestrator = new Orchestrator({ lintOnly: true, checks: [] });

            let initEmitted = false;
            orchestrator.on('init', () => { initEmitted = true; });

            await orchestrator.run();
            assert.ok(initEmitted);
        });

        it('should emit cleanUp event when not lintOnly', async () => {
            const orchestrator = new Orchestrator({ lintOnly: false, files: [], checks: [] });

            let cleanUpEmitted = false;
            orchestrator.on('cleanUp', () => { cleanUpEmitted = true; });

            await orchestrator.run();
            assert.ok(cleanUpEmitted);
        });

        it('should pass orchestrator to event listeners', async () => {
            const orchestrator = new Orchestrator({ lintOnly: true, checks: [] });

            let receivedOrch = null;
            orchestrator.on('init', (orch) => { receivedOrch = orch; });

            await orchestrator.run();
            assert.strictEqual(receivedOrch, orchestrator);
        });

        it('should emit afterTests event when preTests fail', async () => {
            const orchestrator = new Orchestrator({ lintOnly: false, files: [], checks: [] });
            orchestrator.addPreCheck(async () => ({ success: false, label: 'fail', output: 'err' }));

            let afterEmitted = false;
            orchestrator.on('afterTests', () => { afterEmitted = true; });

            const result = await orchestrator.run();
            assert.equal(result.exitCode, 1);
            assert.ok(afterEmitted);
        });

        it('should pass orchestrator to preTest callbacks', async () => {
            const orchestrator = new Orchestrator({ lintOnly: true, checks: [] });

            let receivedOrch = null;
            orchestrator.addPreCheck(async (orch) => {
                receivedOrch = orch;
                return { success: true, label: 'test' };
            });

            await orchestrator.run();
            assert.strictEqual(receivedOrch, orchestrator);
        });
    });
});
