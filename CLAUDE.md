# VSCode Repo Stats Extension

## Project Overview

A VSCode extension for visualizing repository statistics with three views:

- Contributors Dashboard (LOC per contributor, commits over time)
- Code Frequency Graph (additions/deletions over time)
- Repository Treemap (visual map by lines of code)

## Architecture

- Extension Host: TypeScript, esbuild, simple-git, scc binary, Worker Threads
- Webview: React + TypeScript, Vite, D3.js, Plotly.js, Zustand
- Communication: postMessage API between extension and webview

## Build & Test Commands

```bash
npm run build             # Build extension and webview
npm run watch             # Watch mode for development
npm run test              # Run unit + integration tests
npm run test:unit         # Webview unit tests (Vitest)
npm run test:integration  # Extension tests (@vscode/test-electron)
npm run test:e2e          # UI tests (vscode-extension-tester)
npm run test:e2e:setup    # First-time: download VSCode + ChromeDriver
npm run lint              # ESLint
npm run typecheck         # TypeScript type checking
npm run validate          # Full validation (typecheck + lint + test + package)
npm run package           # Create .vsix
```

## Autonomous Testing

All testing must be command-line executable:

- `npm run test:unit` - Vitest for webview React components
- `npm run test:integration` - Runs VSCode headlessly via @vscode/test-electron
- `npm run test:e2e` - Full UI testing via vscode-extension-tester (Selenium-based)
- `npm run build && npm run package` - Verify compilation produces valid .vsix

### E2E Testing (vscode-extension-tester)

E2E tests can interact with the actual VSCode UI:

- Open command palette and execute commands
- Click on views, buttons, and UI elements
- Verify notifications, webview content, etc.
- Tests are in `test/e2e/` directory

First-time setup: `npm run test:e2e:setup` (downloads VSCode + ChromeDriver)

Use E2E tests to verify the extension works as a user would experience it.

## Autonomous Validation Rules

**During development:** Fix obvious errors as you go, but don't run full validation after every edit.

**After completing a feature or logical unit of work:**
1. Run `npm run typecheck` - Fix TypeScript errors
2. Run `npm run lint` - Fix lint errors
3. Run `npm run test` - Ensure all tests pass

**Before committing:** Run `npm run validate` (runs all checks + package)

**NEVER commit code that fails validation.**

## Code Style

- TypeScript strict mode enabled
- Functional React components with hooks only
- Use Zustand for webview state (not Redux or Context)
- IMPORTANT: Never block the extension host with synchronous operations
- Consider Worker Threads for operations that may exceed 100ms

## Architectural Principles (NOT rigid structure)

The architecture should evolve during implementation. These are guiding principles:

1. **Separation of Concerns**: Extension host handles data, webview handles display
2. **Single Responsibility**: Each module does one thing well
3. **Testability**: Design for easy mocking and unit testing
4. **Graceful Degradation**: Handle missing dependencies (e.g., scc not installed)
5. **Non-blocking**: Long operations must not freeze VSCode

**Document architectural decisions in ARCHITECTURE_DECISIONS.md as you make them.**

## Backend/Frontend Separation (Critical for Testability)

The extension host (backend) must be testable WITHOUT VSCode running. Follow these patterns:

### Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│  VSCode Integration Layer (thin)                        │
│  - extension.ts: activate/deactivate                    │
│  - WebviewProvider: postMessage bridge                  │
│  - Commands: register and delegate                      │
└─────────────────────────────────────────────────────────┘
                          │ calls
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Core Business Logic (VSCode-independent)               │
│  - Analyzers: pure functions, no VSCode imports         │
│  - Data transformers: convert raw data to view models   │
│  - Cache logic: abstract storage interface              │
└─────────────────────────────────────────────────────────┘
                          │ uses
                          ▼
┌─────────────────────────────────────────────────────────┐
│  External Dependencies (injectable)                     │
│  - Git operations (simple-git)                          │
│  - LOC counting (scc binary)                            │
│  - File system operations                               │
└─────────────────────────────────────────────────────────┘
```

### Rules for Testable Backend

1. **No `import * as vscode` in core logic** - Only in the thin integration layer
2. **Dependency injection** - Pass dependencies as constructor args or function params
3. **Pure functions preferred** - Given same input, always same output
4. **Interfaces for external deps** - Define interfaces, inject implementations
5. **Thin VSCode layer** - extension.ts should only wire things together, no logic

### Example Pattern

```typescript
// BAD - untestable, imports vscode directly
import * as vscode from "vscode";
export function analyzeRepo() {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  // ... analysis logic mixed with VSCode calls
}

// GOOD - testable, VSCode-independent
export function analyzeRepo(
  repoPath: string,
  gitClient: GitClient,
): AnalysisResult {
  // Pure business logic, no VSCode imports
}

// VSCode integration layer calls it:
const result = analyzeRepo(workspacePath, new SimpleGitClient(workspacePath));
```

### Testing Strategy

- **Unit tests (Vitest)**: Test core logic with mocked dependencies
- **Integration tests (@vscode/test-electron)**: Test VSCode integration layer
- **E2E tests (extension-tester)**: Test full user workflows

## Testing Conventions

- Extension tests use VSCode's test framework (@vscode/test-electron)
- Webview tests use Vitest + React Testing Library
- Mock simple-git and scc for unit tests
- Integration tests use fixture repository at `test/fixtures/sample-repo/`

## Common Mistakes to Avoid

- YOU MUST NOT call scc directly - always use the LOCCounter wrapper
- NEVER block the extension host with synchronous operations
- Always use Worker Threads for operations over 100ms
- YOU MUST handle the case where scc binary is not installed
- NEVER commit without running tests first
- Never import from 'vscode' in webview code (use message passing)

## Debugging (for automated tests)

- Add console.log statements and check test output
- Use VSCode's OutputChannel in tests to capture extension logs
- For webview issues, test components in isolation with Vitest

## Key Dependencies

- simple-git: ^3.x - Git operations
- scc: External binary - Must be in PATH
- d3-hierarchy: ^3.x - Treemap layout
- plotly.js-basic-dist: ^2.x - Charts (use basic-dist for smaller bundle)
