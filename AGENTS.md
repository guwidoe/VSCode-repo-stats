@~/repositories/vibe-setup/AGENTS.md

# VSCode Repo Stats Extension

VSCode extension for repo statistics: contributors, code frequency, and treemap views.

## Stack

- Extension: TypeScript, esbuild, simple-git, scc binary
- Webview: React, Vite, D3.js, Plotly.js, Zustand

## Project Rules

- Run `npm run validate` before finishing any feature (required for publishing)
- Use LOCCounter wrapper for scc (never call scc directly)
- Handle missing scc binary gracefully
- Zustand for webview state (not Redux/Context)
- No `import * as vscode` in core logic—only in integration layer
