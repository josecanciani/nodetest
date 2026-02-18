# nodetest - Agent Guidelines

<!-- CRITICAL_RULES
- RUN_TESTS_AFTER_CHANGES: Always run `npm test` after making any code changes, before reporting completion
- NO_TYPESCRIPT: Use vanilla JavaScript only, no TypeScript syntax anywhere including JSDoc
- JS_EXTENSION: Always include .js extension in ES Module imports
- JSDOC_PARSEABLE: JSDoc must be parseable by standard tools (no TypeScript-style ? in inline types)
-->

## Quick Reference

**Critical Rules:**

- **Always run `npm test` after any code change**, before reporting completion
- Use vanilla JavaScript only—**no TypeScript syntax anywhere**
- Always include `.js` extension in ES Module imports
- JSDoc must be parseable by standard tools (no TypeScript-style `?` in inline types)

## Project Overview

nodetest is a test runner for Modern Javascript Applications, that allow for faster test runs by parallelizing pre-test checks.

## Tech Stack

- **Language**: Modern vanilla JavaScript (ES2022+) with JSDoc for type annotations. **No TypeScript syntax anywhere**, including in JSDoc comments
- **Module System**: ES Modules (`import`/`export`)
- **Runtime**: Node.js 20+
- **Documentation**: JSDoc (must be parseable and syntax-error-free)

## Code Style

### General Rules
- Use vanilla JavaScript only—no TypeScript, no transpilation
- Use ES Modules (`import`/`export`) for all imports and exports
- All functions, classes, and modules must have JSDoc annotations
- JSDoc must be valid and parseable by standard JSDoc tools (not just TypeScript's JSDoc parser)

### JSDoc Requirements

```javascript
/**
 * @typedef {Object} ExampleResult
 * @property {string} data - The result data
 */

/**
 * Description of the function
 * @param {string} paramName - Parameter description
 * @returns {Promise<ExampleResult>} Return value description
 */
function exampleFunction(paramName) {
  // implementation
}
```

### JSDoc Pitfalls to Avoid

**Never use TypeScript-style optional properties (`?`) in inline object types.** Standard JSDoc parsers don't support this syntax.

```javascript
// ❌ WRONG - Will cause JSDoc parse errors
/** @param {{name?: string}} options */

// ✅ CORRECT - Use @typedef with optional properties
/**
 * @typedef {Object} Options
 * @property {string} [name] - Optional name
 */
/** @param {Options} options */

// ✅ CORRECT - For simple cases, use union with undefined
/** @param {{name: string|undefined}} options */
```

**Never use generic `Object` in return types.** Define a `@typedef` instead.

```javascript
// ❌ WRONG - Generic Object type
/** @returns {Object} */

// ✅ CORRECT - Define specific typedef
/**
 * @typedef {Object} UserProfile
 * @property {string} id
 * @property {string} name
 */
/** @returns {UserProfile} */
```

### JSDoc Type References

Use `@module` definitions to reference types across files. This is the **preferred approach**:

```javascript
// models.js - Define the module and types
/** @module models */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 */

// logic.js - Reference types from other modules
/**
 * @param {module:models~User} user
 */
function processUser(user) {
    console.log(user.name);
}
```

### ES Modules Patterns
```javascript
// Importing
import { something } from './module.js';  // Always include .js extension
import express from 'express';            // Default imports for npm packages

// Exporting
export { functionA, functionB };          // Named exports
export default router;                    // Default export
```

### Naming Conventions
- **Files**: camelCase (e.g., `searchEngine.js`)
- **Functions/Variables**: camelCase
- **Classes**: PascalCase
- **Constants**: UPPER_SNAKE_CASE

## Agent Instructions

### Do
- **Always run `npm test` after any code change**, before reporting completion
- Handle errors gracefully with meaningful messages
- Keep the CLI thin—delegate to client functions

### Don't
- Don't use TypeScript or any compile-to-JS language
- Don't add unnecessary dependencies
- Don't access databases from CLI or client
- **NEVER** commit things without me approving the changes.
