# nodetest

A fast, batteries-included test orchestrator for Node.js projects. Pre-test checks (linters, server startup, database seeding) run in parallel using all available CPU cores — so your CI pipeline spends less time waiting and more time catching bugs.

## Why nodetest?

- **Parallel pre-test checks** — Linters, type checks, and custom tasks run concurrently with a configurable concurrency limit (defaults to `os.availableParallelism()`), dramatically reducing wall-clock time on multi-core machines.
- **Built-in linters** — ESLint, JSDoc validation, JSDoc Object-type check, and README documentation coverage ship out of the box. Remove or replace any of them via settings.
- **Lifecycle hooks** — `cleanUp`, `afterTests`, and `shutdown` events let you manage shared resources (servers, databases, temp files) cleanly.
- **Context-aware callbacks** — Every callback (preTest, events) receives the Orchestrator instance with helper methods like `isRunningSpecificFiles()` and `requiresForceClean()`.
- **Fail-fast on lint errors** — Tests won't run if pre-test checks fail. This encourages developers (and AI agents) to stay vigilant about types and documentation in a dynamically-typed system — no need to switch to TypeScript if you don't want to.
- **Zero config for simple projects** — `Orchestrator.fromCLI()` parses `--lint-only`, `--force`, and `--files` from the command line automatically.

## Installation

```bash
npm install --save-dev github:josecanciani/nodetest
```

## Quick Start

```javascript
import { Orchestrator } from 'nodetest';

const orchestrator = Orchestrator.fromCLI();
const { exitCode } = await orchestrator.run();
process.exit(exitCode);
```

That's it. This gives you 4 built-in linters, parallel execution, CLI flags, and graceful shutdown handling.

## Examples

### Custom settings

```javascript
import { Orchestrator, runEslint, runJsdoc } from 'nodetest';

const orchestrator = new Orchestrator({
    lintOnly: false,
    forceClean: false,
    parallelism: 4,
    linters: [runEslint, runJsdoc] // only these two, skip the rest
});

const { exitCode } = await orchestrator.run();
process.exit(exitCode);
```

### Starting a server before tests

Let's say you have multiple read-only tests hitting an HTTP API, we want to start the server once and keep it running for all tests. We can do this as a preTest callback. It runs in parallel with linters — no wasted time!

```javascript
import { Orchestrator } from 'nodetest';

const orchestrator = Orchestrator.fromCLI();
let serverProcess = null;

/** @param {import('nodetest').Orchestrator} orch */
orchestrator.addPreCheck(async (orch) => {
    serverProcess = spawn('node', ['src/index.js'], { stdio: 'pipe' });
    const ready = await pollUntilReady('http://localhost:3000/status');
    return {
        success: ready,
        label: 'Server startup',
        output: ready ? '' : 'Server failed to start in time.'
    };
});

// Clean up after tests
/** @param {import('nodetest').Orchestrator} orch */
orchestrator.on('afterTests', async (orch) => {
    if (serverProcess) serverProcess.kill('SIGTERM');
});

// Also clean up on unexpected shutdown (SIGTERM/SIGINT)
/** @param {import('nodetest').Orchestrator} orch */
orchestrator.onShutdown(async (orch) => {
    console.log(`Received ${orch.getShutdownSignal()}, cleaning up...`);
    if (serverProcess) serverProcess.kill('SIGTERM');
});

const { exitCode } = await orchestrator.run();
process.exit(exitCode);
```

### Database seeding (only for full suite)

Every callback receives the Orchestrator instance. Use `isRunningSpecificFiles()` to skip expensive setup when running a subset of tests:

```javascript
/** @param {import('nodetest').Orchestrator} orch */
orchestrator.addPreCheck(async (orch) => {
    if (orch.isRunningSpecificFiles()) {
        // Running specific files — skip the full preseed
        return { success: true, label: 'Database preseeding (skipped, will seed on demand)' };
    }
    await preseedAllTestDatabases();
    return { success: true, label: 'Database preseeding' };
});
```

### Interactive cleanup before tests

The `cleanUp` event runs before any preTest callbacks. Use `requiresForceClean()` to check if `--force` was passed:

```javascript
/** @param {import('nodetest').Orchestrator} orch */
orchestrator.on('cleanUp', async (orch) => {
    if (orch.requiresForceClean()) {
        await deleteAllTestDatabases();
    } else {
        const stale = await findStaleDatabases();
        if (stale.length > 0) {
            console.log(`Found ${stale.length} stale databases. Use --force to remove.`);
            throw new Error('Cleanup required');
        }
    }
});
```

### Lint-only mode

Run just the pre-test checks (linters) without executing any tests:

```bash
node tests/orchestrator.js --lint-only
```

### Run specific test files

```bash
node tests/orchestrator.js --files server/status.test.js server/search.test.js
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--lint-only` | Run only pre-test checks, skip test execution |
| `--force` | Force cleanup phase (check with `orch.requiresForceClean()`) |
| `--files <paths...>` | Run only the specified test files |

## Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
