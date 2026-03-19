# AGENTS.md

This file is for coding agents working in `opencode-web-service`.

## Project Snapshot

- Runtime: Node.js ESM CLI package.
- Package manager: `npm` (`package-lock.json` is committed).
- Entry point: `src/index.js`.
- Main source folders: `src/commands/`, `src/utils/`, `test/`.
- Supported runtime from `package.json`: Node `>=18`.
- CI coverage: GitHub Actions runs tests on Node 20 and 22.
- Build system: none; the package ships source files directly.
- Lint system: none configured in the repository.
- Existing AGENTS file: none was present before this file.

## Agent Rules Files

- Cursor rules: none found in `.cursor/rules/`.
- Legacy Cursor rules: no `.cursorrules` file found.
- Copilot instructions: no `.github/copilot-instructions.md` file found.
- Do not assume hidden editor-specific rules beyond what is in this file.

## Install And Setup

- Install dependencies: `npm ci`
- Local package install fallback: `npm install`
- Check Node version: `node --version`
- The repo is a CLI, so most behavior is exercised through tests or direct `node` execution.

## Build / Lint / Test Commands

### Build

- There is no build script and no transpilation step.
- Source is published directly from `src/`.
- If you need a packaging sanity check, use: `npm pack --dry-run`

### Lint

- There is no lint script in `package.json`.
- There is no ESLint, Prettier, or EditorConfig config checked in.
- Match the existing house style manually instead of introducing new tooling.

### Test

- Full test suite: `npm test`
- Under the hood, `npm test` runs: `node --test test/*.test.js`
- Direct full suite run: `node --test test/*.test.js`
- CI command: `npm ci && npm test`

### Run A Single Test File

- Preferred: `node --test test/index.test.js`
- Another example: `node --test test/config-cmd.test.js`
- This is more reliable than trying to pass a file through `npm test`, because the npm script already hardcodes `test/*.test.js`.

### Run A Single Named Test

- Use Node test name filtering: `node --test --test-name-pattern "cli prints version" test/index.test.js`
- You can also target a broader pattern: `node --test --test-name-pattern "config set" test/config-cmd.test.js`

### Useful Targeted Test Sets

- Command layer only: `node --test test/*-cmd.test.js`
- Utility/config tests: `node --test test/config*.test.js test/env.test.js test/output.test.js`
- Runtime/CLI behavior: `node --test test/index*.test.js test/service.test.js test/status*.test.js`

## Repository Structure

- `src/index.js`: CLI entry, command dispatch, top-level error boundary, help/version output.
- `src/commands/*.js`: user-facing commands such as `setup`, `status`, `config`, `upgrade`.
- `src/utils/*.js`: config, password, output, and systemd helpers.
- `src/tunnel-server.js`: ngrok-backed runtime for tunnel mode.
- `test/*.test.js`: Node built-in test runner coverage.
- `.github/workflows/ci.yml`: test matrix on Node 20 and 22.
- `.github/workflows/publish.yml`: test before npm publish.

## Code Style Guidelines

### Language And Modules

- Use plain JavaScript, not TypeScript.
- Keep files as ESM modules.
- Use explicit `.js` extensions in local imports.
- Prefer `node:` specifiers for built-in modules.
- Default exports are used for command entrypoints.
- Named exports are used for reusable helpers and constants.

### Formatting

- Use 2-space indentation.
- Omit semicolons.
- Keep trailing commas where they improve diff quality and match nearby code.
- Prefer single quotes.
- Preserve existing inline alignment only where it already exists; do not reformat whole files gratuitously.
- Keep blank lines sparse and purposeful.

### Imports

- Group imports in this order when practical: built-ins, external packages, local modules.
- Within a group, keep imports stable and readable rather than aggressively sorted.
- It is common here to alias default dependency implementations with a leading underscore, for example `log as _log` or `execSync as _execSync`.
- Follow that underscore-alias pattern when a module supports dependency injection for tests.

### Dependency Injection And Testability

- Many command modules accept `deps = {}` as the third parameter.
- Destructure defaults from `deps` near the top of the function.
- Keep side effects behind injectable dependencies when adding new command logic.
- Prefer small pure helpers plus a thin command wrapper.
- If a helper is easy to unit test independently, export it by name.

### Naming

- Use `camelCase` for variables and functions.
- Use `UPPER_SNAKE_CASE` for shared constants like `UNIT_NAME`.
- Command modules are named after the CLI command, for example `src/commands/password.js`.
- Test files mirror the feature or module they cover, for example `test/password.test.js` and `test/password-cmd.test.js`.
- Use descriptive names over abbreviations unless the file already uses a local short form like `cfg`.

### Types And Data Shapes

- There is no static type system in this repo.
- Use explicit runtime validation for user input and config values.
- Return plain objects for structured data.
- Keep object shapes simple and predictable.
- Prefer `null` for intentionally missing values when the surrounding code already uses that convention.

### Control Flow

- Prefer guard clauses and early returns over deep nesting.
- Validate inputs close to where they enter the system.
- Keep command handlers readable and linear.
- Use small helper functions when a block mixes validation, transformation, and side effects.

### Error Handling

- Throw `Error` from low-level helpers when validation fails.
- Catch errors at command or CLI boundaries and present user-friendly messages.
- At the top level, log `err.message` rather than dumping full stacks for expected operational failures.
- Use explicit exit codes through injected `exitProcess` hooks where the command semantics require it.
- Treat cancellation paths as normal control flow; log a short `Cancelled.` message and return.
- When a failure has a likely next action, include a short hint, such as pointing users to `ocweb logs`.

### Logging And Output

- Use the shared logger from `src/utils/output.js` for user-facing CLI messaging.
- Existing log levels are `success`, `error`, `warn`, `info`, `step`, and `dim`.
- Keep messages short, actionable, and CLI-friendly.
- Preserve the current style of friendly operational messaging.

### Filesystem And Process Work

- Be careful with paths, permissions, and systemd unit content; this project manages real user files.
- Existing code writes sensitive files with mode `0600`; preserve that behavior.
- When shelling out, prefer focused wrappers like the existing `run()` / `systemctl()` helpers.
- Quote paths when generating shell or systemd command strings.

### Tests

- Use Node's built-in `node:test` framework.
- Use `node:assert/strict` for assertions.
- Keep tests focused and descriptive; current test names are sentence-style behavior statements.
- Prefer dependency injection and temp directories over brittle global mocks.
- When a feature exposes both helper and CLI behavior, test both layers if practical.
- Do not add another test framework unless the repository explicitly adopts one.

## Practical Guidance For Future Changes

- Do not add a build step unless the user asks for one.
- Do not add lint tooling just to satisfy style; follow the repository's existing conventions.
- Preserve ESM and current CLI command structure.
- Preserve testability patterns based on injectable dependencies.
- If you add a new command, wire it into `COMMANDS` in `src/index.js` and add direct tests for the command module plus at least one CLI-level behavior test when relevant.
- If you touch packaging or publish behavior, review `test/publish*.test.js` and `.github/workflows/publish.yml`.
- If you touch service lifecycle behavior, review `src/utils/systemd.js` and the `status`, `service`, `setup`, `upgrade`, and `uninstall` tests.

## Verification Checklist

- Run `npm test` after meaningful code changes.
- For a small targeted change, run at least the directly affected test file with `node --test path/to/file.test.js`.
- For bug fixes, prefer adding or updating a focused regression test first.
- If you changed CLI text or command behavior, check related README coverage tests as well.
