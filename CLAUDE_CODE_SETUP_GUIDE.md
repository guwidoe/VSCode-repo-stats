# Claude Code Setup Implementation Guide

This guide documents exactly how to set up Claude Code for autonomous development of this VSCode extension.

---

## Step 1: Install MCP Servers

### 1.1 Task Master MCP
Converts PRDs into trackable task lists with status management.

```bash
claude mcp add task-master-ai --scope user --env TASK_MASTER_TOOLS="core" -- npx -y task-master-ai@latest
```

**Verify installation:**
```bash
claude mcp list
```

### 1.2 Sequential Thinking MCP
Provides structured, step-by-step reasoning for complex decisions.

```bash
claude mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
```

### 1.3 Memory Server (Optional)
Persistent knowledge graph for context across sessions.

```bash
claude mcp add memory -- npx -y @modelcontextprotocol/server-memory
```

---

## Step 2: Create CLAUDE.md

Create `CLAUDE.md` at project root with this content:

```markdown
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
- `npm run build` - Build extension and webview
- `npm run watch` - Watch mode for development
- `npm run test` - Run all tests
- `npm run test:unit` - Webview unit tests (Vitest)
- `npm run test:integration` - Extension tests (@vscode/test-electron)
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript type checking
- `npm run validate` - Full validation (typecheck + lint + test + package)
- `npm run package` - Create .vsix

## Autonomous Validation Rules
After ANY code change, YOU MUST:
1. Run `npm run typecheck` - Fix TypeScript errors before proceeding
2. Run `npm run lint` - Fix lint errors before proceeding
3. Run `npm run test` - All tests must pass before committing

NEVER commit code that fails validation.

## Code Style
- TypeScript strict mode enabled
- Functional React components with hooks only
- Use Zustand for webview state (not Redux or Context)
- All git operations via `src/analyzers/gitAnalyzer.ts`
- All LOC counting via `src/analyzers/locCounter.ts`

## File Structure
src/
├── extension.ts           # Main entry point
├── analyzers/
│   ├── gitAnalyzer.ts     # simple-git wrapper
│   ├── locCounter.ts      # scc wrapper
│   └── coordinator.ts     # Orchestrates analysis
├── cache/
│   └── cacheManager.ts    # workspaceState persistence
├── workers/
│   └── analysisWorker.ts  # Heavy computation
├── webview/
│   └── provider.ts        # WebviewViewProvider
└── types/
    └── index.ts           # Shared interfaces

webview-ui/                # React app (Vite)
├── src/
│   ├── App.tsx
│   ├── components/
│   ├── store/
│   └── hooks/
└── vite.config.ts

## Common Mistakes to Avoid
- NEVER call scc directly - use LOCCounter wrapper
- NEVER block extension host with synchronous operations
- Always use Worker Threads for operations over 100ms
- MUST handle case where scc binary is not installed
```

---

## Step 3: Create Skills Directory Structure

```
.claude/
├── skills/
│   ├── vscode-testing/
│   │   └── SKILL.md
│   ├── react-webview/
│   │   └── SKILL.md
│   └── git-analysis/
│       └── SKILL.md
└── settings.json
```

---

## Step 4: Create VSCode Testing Skill

Create `.claude/skills/vscode-testing/SKILL.md`:

```markdown
---
name: vscode-extension-testing
description: Run and validate VSCode extension tests, handle test failures, verify extension activation
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
---

# VSCode Extension Testing Skill

## When to Use
Apply when running tests, debugging failures, or verifying extension activation.

## Test Execution Protocol

### Pre-test Checklist
1. `npm run build` - Extension builds without errors
2. `npx tsc --noEmit` - No TypeScript errors
3. `npm run lint` - Lint passes

### Running Tests
# Full test suite
npm run test

# Extension tests only (VSCode test runner)
npm run test:integration

# Webview React tests (Vitest)
npm run test:unit

### Handling Failures
1. Read error output carefully
2. Check for timeout issues (increase timeout in config)
3. Verify mock data matches expected structure
4. Check VSCode API version compatibility

### Validation Checklist
After tests pass:
- [ ] Extension activates without errors
- [ ] Commands register correctly
- [ ] Webview opens and renders
- [ ] No memory leaks in extension host
```

---

## Step 5: Create React Webview Skill

Create `.claude/skills/react-webview/SKILL.md`:

```markdown
---
name: react-webview-development
description: Develop React components for VSCode webviews, handle postMessage communication, implement D3/Plotly visualizations
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
---

# React Webview Development Skill

## When to Use
Apply when creating React components, implementing D3.js treemap, adding Plotly charts, or setting up postMessage communication.

## Component Pattern
import React from 'react';
import { useStore } from '../store';

export const MyComponent: React.FC<Props> = ({ prop }) => {
  const data = useStore((state) => state.data);
  return <div>{/* JSX */}</div>;
};

## postMessage Communication
// Send to extension
const vscode = acquireVsCodeApi();
vscode.postMessage({ type: 'requestData', payload: {} });

// Receive from extension
useEffect(() => {
  const handler = (event: MessageEvent) => {
    const message = event.data;
    // Handle message
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);

## D3 Treemap Pattern
import * as d3 from 'd3-hierarchy';

const treemapLayout = d3.treemap<TreemapNode>()
  .size([width, height])
  .paddingInner(2);

const root = d3.hierarchy(data)
  .sum((d) => d.lines || 0);

treemapLayout(root);

## Testing
Mock VSCode API in tests:
const mockVsCode = {
  postMessage: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
};
(window as any).acquireVsCodeApi = () => mockVsCode;
```

---

## Step 6: Create Git Analysis Skill

Create `.claude/skills/git-analysis/SKILL.md`:

```markdown
---
name: git-analysis
description: Implement git analysis features using simple-git, handle contributor stats, commit history, and code frequency
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
---

# Git Analysis Skill

## When to Use
Apply when implementing simple-git operations, calculating contributor stats, or building code frequency data.

## simple-git Patterns

### Initialize
import simpleGit, { SimpleGit } from 'simple-git';
const git: SimpleGit = simpleGit(repoPath);

### Get Contributors
const log = await git.log(['--all', '--format=%an|%ae|%ad|%H']);

### Get Code Frequency
const stats = await git.log(['--all', '--numstat', '--format=%H|%ad']);

### Get Current HEAD
const head = await git.revparse(['HEAD']);

## Error Handling
try {
  const result = await git.log();
} catch (error) {
  if (error.message.includes('not a git repository')) {
    throw new NotAGitRepoError(repoPath);
  }
  throw error;
}

## Performance for Large Repos
- Limit commits: git.log(['-n', '10000'])
- Use --since for time-bounded queries
- Stream results for 100k+ commit repos

## Caching
- Cache by HEAD SHA
- Invalidate when SHA changes
- Store per-file stats with blob SHA
```

---

## Step 7: Create Settings File

Create `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(npx tsc *)",
      "Bash(npx vsce *)",
      "Bash(npx vitest *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force*)",
      "Bash(npm publish*)"
    ]
  }
}
```

---

## Step 8: Create package.json

Create `package.json` with extension manifest and scripts:

Key scripts to include:
```json
{
  "scripts": {
    "compile": "npm run compile:extension && npm run compile:webview",
    "compile:extension": "esbuild src/extension.ts --bundle --outfile=out/extension.js --external:vscode --format=cjs --platform=node",
    "compile:webview": "vite build --config webview-ui/vite.config.ts",
    "watch": "npm-run-all -p watch:*",
    "watch:extension": "esbuild src/extension.ts --bundle --outfile=out/extension.js --external:vscode --format=cjs --platform=node --watch",
    "watch:webview": "vite build --watch --config webview-ui/vite.config.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src webview-ui/src --ext ts,tsx",
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run",
    "test:integration": "vscode-test",
    "validate": "npm run typecheck && npm run lint && npm run test && npm run package",
    "package": "vsce package --no-dependencies",
    "build": "npm run compile"
  }
}
```

---

## Step 9: Create Test Configuration

### vitest.config.ts (for webview unit tests)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./webview-ui/test/setup.ts'],
    include: ['webview-ui/**/*.test.{ts,tsx}'],
  }
});
```

### .vscode-test.js (for extension integration tests)
```javascript
const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  files: 'out/test/**/*.test.js',
  version: 'stable',
  workspaceFolder: './test/fixtures/sample-repo',
  mocha: {
    ui: 'tdd',
    timeout: 20000
  }
});
```

---

## Step 10: Create Task Master PRD

Create `.taskmaster/docs/prd.txt` combining ARCHITECTURE.md phases and SPECIFICATIONS.md acceptance criteria.

Then run Task Master to parse: `parse_prd`

---

## Step 11: Create Project Scaffold

Create the directory structure:
```
src/
├── extension.ts
├── analyzers/
├── cache/
├── workers/
├── webview/
└── types/

webview-ui/
├── src/
├── test/
└── vite.config.ts

test/
├── fixtures/sample-repo/
└── extension/
```

---

## Step 12: Verify Setup

1. `claude mcp list` - Verify MCP servers installed
2. `npm install` - Install dependencies
3. `npm run build` - Verify build works
4. `npm run test` - Verify tests run
5. `npm run validate` - Full validation passes
6. Press F5 in VSCode - Extension Development Host launches
