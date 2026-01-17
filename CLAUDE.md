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
npm run build          # Build extension and webview
npm run watch          # Watch mode for development
npm run test           # Run all tests
npm run test:unit      # Webview unit tests (Vitest)
npm run test:integration  # Extension tests (@vscode/test-electron)
npm run lint           # ESLint
npm run typecheck      # TypeScript type checking
npm run validate       # Full validation (typecheck + lint + test + package)
npm run package        # Create .vsix
```

## Development Workflow
- Press F5 in VSCode to launch Extension Development Host
- Use Command Palette: "Repo Stats: Show Dashboard" to test
- Webview hot-reloads via Vite during development

## Autonomous Validation Rules
After ANY code change, YOU MUST:
1. Run `npm run typecheck` - Fix TypeScript errors before proceeding
2. Run `npm run lint` - Fix lint errors before proceeding
3. Run `npm run test` - All tests must pass before committing

**NEVER commit code that fails validation.**

## Code Style
- TypeScript strict mode enabled
- Functional React components with hooks only
- Use Zustand for webview state (not Redux or Context)
- All git operations via `src/analyzers/gitAnalyzer.ts`
- All LOC counting via `src/analyzers/locCounter.ts`
- IMPORTANT: Never block the extension host with synchronous operations
- Always use Worker Threads for operations over 100ms

## File Structure
```
src/
├── extension.ts           # Main entry point (activate/deactivate)
├── analyzers/
│   ├── gitAnalyzer.ts     # Git operations via simple-git
│   ├── locCounter.ts      # LOC via scc binary
│   ├── coordinator.ts     # Orchestrates analysis
│   └── fileWatcher.ts     # Change detection
├── cache/
│   └── cacheManager.ts    # workspaceState persistence
├── workers/
│   ├── analysisWorker.ts  # Worker thread entry
│   └── workerPool.ts      # Worker management
├── webview/
│   └── provider.ts        # WebviewViewProvider
└── types/
    ├── index.ts           # Shared interfaces
    ├── contributor.ts     # ContributorStats
    ├── frequency.ts       # CodeFrequency
    └── treemap.ts         # TreemapNode

webview-ui/                # React app (Vite)
├── src/
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Main app component
│   ├── store/
│   │   └── index.ts       # Zustand store
│   ├── components/
│   │   ├── Navigation.tsx
│   │   ├── contributors/
│   │   │   ├── ContributorsPanel.tsx
│   │   │   ├── ContributorCard.tsx
│   │   │   └── CommitsChart.tsx
│   │   ├── frequency/
│   │   │   └── CodeFrequencyPanel.tsx
│   │   └── treemap/
│   │       ├── TreemapPanel.tsx
│   │       ├── TreemapCanvas.tsx
│   │       └── Breadcrumb.tsx
│   ├── hooks/
│   │   └── useVsCodeApi.ts
│   └── utils/
│       └── colors.ts      # Language colors
├── index.html
├── vite.config.ts
└── tsconfig.json

test/
├── fixtures/
│   └── sample-repo/       # Git repo for integration tests
├── extension/
│   ├── gitAnalyzer.test.ts
│   ├── locCounter.test.ts
│   └── coordinator.test.ts
└── runTest.ts             # VSCode test runner entry
```

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

## Debugging
- Extension logs: Output panel > "Repo Stats"
- Webview DevTools: Command Palette > "Developer: Open Webview Developer Tools"

## Key Dependencies
- simple-git: ^3.x - Git operations
- scc: External binary - Must be in PATH
- d3-hierarchy: ^3.x - Treemap layout
- plotly.js-basic-dist: ^2.x - Charts (use basic-dist for smaller bundle)
