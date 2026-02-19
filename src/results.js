/**
 * @module results
 * @fileoverview Results objects for Orchestrator checks
 */

/**
 * Result of a pre-check (linter) execution.
 */
export class CheckResult {
    /**
     * @param {boolean} success - Whether the check passed
     * @param {string} label - Display label (e.g. "JSDoc Lint")
     * @param {string} [output] - Error output or details
     */
    constructor(success, label, output) {
        this.success = success;
        this.label = label;
        this.output = output;
    }
}
