/**
 * @module runner
 * @fileoverview Concurrency-limited parallel task runner
 */

import { availableParallelism } from 'node:os';

/**
 * @typedef {Object} ParallelRunnerResult
 * @property {Array} results - Array of task results in the same order as input tasks
 */

/**
 * Runs async tasks with a concurrency limit, similar to how node:test
 * limits parallel test file execution.
 */
export class ParallelRunner {
    /**
     * Creates a new ParallelRunner
     * @param {number} [concurrency] - Maximum number of tasks to run simultaneously.
     *   Defaults to os.availableParallelism().
     */
    constructor(concurrency) {
        this.concurrency = concurrency ?? availableParallelism();
    }

    /**
     * Runs an array of async task functions with the configured concurrency limit.
     * Tasks are started in order. As each task completes, the next pending task starts.
     * Results are returned in the same order as the input tasks.
     *
     * @param {Function[]} tasks - Array of async functions to execute
     * @returns {Promise<Array>} Array of results in the same order as input tasks
     */
    async run(tasks) {
        if (tasks.length === 0) return [];

        const results = new Array(tasks.length);
        let nextIndex = 0;

        return new Promise((resolve) => {
            let active = 0;
            let completed = 0;

            const startNext = () => {
                while (active < this.concurrency && nextIndex < tasks.length) {
                    const index = nextIndex++;
                    active++;

                    tasks[index]()
                        .then(result => {
                            results[index] = result;
                        })
                        .catch(err => {
                            results[index] = err;
                        })
                        .finally(() => {
                            active--;
                            completed++;
                            if (completed === tasks.length) {
                                resolve(results);
                            } else {
                                startNext();
                            }
                        });
                }
            };

            startNext();
        });
    }
}
