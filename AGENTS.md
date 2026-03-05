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
- Treat ESLint rules as guardrails: avoid `eslint-disable` comments unless truly exceptional; prefer refactors, and document justification when disabling is unavoidable

## Fallback Policy (learned)

- Do not hide settings wiring issues with UI/runtime fallbacks.
  - If settings are required, gate render/state until settings are loaded.
- Keep user-facing defaults in `package.json` (`contributes.configuration.*.default`) as single source of truth.
  - Avoid duplicating hidden runtime defaults in TS.
- Unexpected failures must not be silent.
  - Do not `catch` and return empty/neutral values unless explicitly expected and documented.
  - For expected degradations, report diagnostics (counts/status) instead of silent masking.
- Prefer `??` over `||` for optional numeric/data fields when `0`/empty values are valid.
- Document partial-data contracts explicitly (see `DATA_SHAPE_CONTRACT.md`).
- Add regression tests for fallback-sensitive paths (settings missing, command failure).
