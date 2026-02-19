/**
 * @fileoverview Tests for the ParallelRunner class
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ParallelRunner } from '../../src/runner/parallelRunner.js';

describe('ParallelRunner', () => {
    describe('constructor', () => {
        it('should default concurrency to availableParallelism()', async () => {
            const { availableParallelism } = await import('node:os');
            const runner = new ParallelRunner();
            assert.equal(runner.concurrency, availableParallelism());
        });

        it('should accept a custom concurrency value', () => {
            const runner = new ParallelRunner(3);
            assert.equal(runner.concurrency, 3);
        });
    });

    describe('run', () => {
        it('should return empty array for empty tasks', async () => {
            const runner = new ParallelRunner(2);
            const results = await runner.run([]);
            assert.deepStrictEqual(results, []);
        });

        it('should return results in the same order as input tasks', async () => {
            const runner = new ParallelRunner(2);
            const tasks = [
                async () => 'a',
                async () => 'b',
                async () => 'c'
            ];
            const results = await runner.run(tasks);
            assert.deepStrictEqual(results, ['a', 'b', 'c']);
        });

        it('should preserve order even when tasks complete out of order', async () => {
            const runner = new ParallelRunner(3);
            const tasks = [
                () => new Promise(r => setTimeout(() => r('slow'), 50)),
                () => new Promise(r => setTimeout(() => r('medium'), 25)),
                () => new Promise(r => setTimeout(() => r('fast'), 5))
            ];
            const results = await runner.run(tasks);
            assert.deepStrictEqual(results, ['slow', 'medium', 'fast']);
        });

        it('should limit concurrency to the configured value', async () => {
            const concurrency = 2;
            const runner = new ParallelRunner(concurrency);

            let active = 0;
            let maxActive = 0;

            /**
             * Creates a task that tracks concurrent execution
             * @returns {Function} Async task function
             */
            function createTrackedTask() {
                return async () => {
                    active++;
                    if (active > maxActive) maxActive = active;
                    await new Promise(r => setTimeout(r, 20));
                    active--;
                    return true;
                };
            }

            const tasks = Array.from({ length: 6 }, () => createTrackedTask());
            await runner.run(tasks);

            assert.ok(
                maxActive <= concurrency,
                `Expected max ${concurrency} concurrent tasks, but saw ${maxActive}`
            );
            assert.equal(maxActive, concurrency, `Expected to reach full concurrency of ${concurrency}`);
        });

        it('should handle a single task', async () => {
            const runner = new ParallelRunner(4);
            const results = await runner.run([async () => 42]);
            assert.deepStrictEqual(results, [42]);
        });

        it('should capture errors as results without rejecting', async () => {
            const runner = new ParallelRunner(2);
            const error = new Error('task failed');
            const tasks = [
                async () => 'ok',
                async () => { throw error; }
            ];
            const results = await runner.run(tasks);
            assert.equal(results[0], 'ok');
            assert.equal(results[1], error);
        });

        it('should work with concurrency of 1 (sequential)', async () => {
            const runner = new ParallelRunner(1);
            const order = [];
            const tasks = [
                async () => { order.push('a'); return 'a'; },
                async () => { order.push('b'); return 'b'; },
                async () => { order.push('c'); return 'c'; }
            ];
            const results = await runner.run(tasks);
            assert.deepStrictEqual(results, ['a', 'b', 'c']);
            assert.deepStrictEqual(order, ['a', 'b', 'c']);
        });

        it('should execute tasks in parallel (time check)', async () => {
            const runner = new ParallelRunner(3);
            const delay = 50;
            const taskCount = 3;

            const start = performance.now();
            await runner.run(Array(taskCount).fill(() => new Promise(r => setTimeout(r, delay))));
            const end = performance.now();
            const duration = end - start;

            // Sequential time would be taskCount * delay (150ms)
            // Parallel time should be close to delay (50ms) + overhead
            // We'll assert it's less than (taskCount - 0.5) * delay to be safe
            assert.ok(duration < (taskCount * delay * 0.8), `Tasks did not run in parallel. Took ${duration}ms, expected < ${taskCount * delay}ms`);
        });
    });
});
