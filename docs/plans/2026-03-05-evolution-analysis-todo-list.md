# Evolution Analysis Feature TODO List

**Date:** 2026-03-05  
**Status:** Completed  
**Related Plan:** `docs/plans/2026-03-05-evolution-analysis-implementation-plan.md`

## Execution Notes

- Keep commits small and reviewable
- Preserve current startup behavior (no mandatory heavy analysis)
- Run `npm run validate` before merge

---

## Phase A — Contracts and Plumbing

### A1. Shared Type Contracts
- [x] Add evolution types in `src/types/index.ts`
  - [x] `EvolutionDimension`
  - [x] `EvolutionTimeSeriesData`
  - [x] `EvolutionResult`
  - [x] `EvolutionStatus`
- [x] Mirror same additions in `webview-ui/src/types.ts`
- [x] Add/update tests in `src/types/index.test.ts`

### A2. Message Protocol
- [x] Extend `WebviewMessage` union with:
  - [x] `requestEvolutionAnalysis`
  - [x] `requestEvolutionRefresh`
- [x] Extend `ExtensionMessage` union with:
  - [x] `evolutionStarted`
  - [x] `evolutionProgress`
  - [x] `evolutionComplete`
  - [x] `evolutionError`
  - [x] optional `evolutionStale`
- [x] Ensure compile passes for all switch statements handling messages

### A3. View Routing
- [x] Add `evolution` to `ViewType`
- [x] Add nav entry in `webview-ui/src/components/Navigation.tsx`
- [x] Add render branch in `webview-ui/src/App.tsx`

---

## Phase B — Backend Analyzer and Cache

### B1. Evolution Analyzer Skeleton
- [x] Create `src/analyzers/evolutionAnalyzer.ts`
- [x] Define constructor inputs:
  - [x] repo path
  - [x] evolution settings
  - [x] optional git dependency adapter for tests
- [x] Define `analyze(onProgress)` public API

### B2. Commit Sampling
- [x] Implement first-parent commit traversal
- [x] Implement date interval sampling (`snapshotIntervalDays`)
- [x] Implement hard cap (`maxSnapshots`)
- [x] Add deterministic ordering (oldest -> newest) in output timeline

### B3. Per-snapshot Ownership Aggregation
- [x] Build file map for snapshot (path -> blob sha)
- [x] Compare with previous snapshot for changed files
- [x] Reuse cached per-file histograms for unchanged files
- [x] Recompute changed files via blame
- [x] Aggregate dimensions:
  - [x] cohort
  - [x] author
  - [x] ext
  - [x] dir
  - [x] domain

### B4. Output Shaping
- [x] Convert aggregates to chart-friendly structure (`ts`, `labels`, `y`)
- [x] Build `EvolutionResult` with metadata (head, branch, settingsHash)

### B5. Evolution Cache
- [x] Create `src/cache/evolutionCacheManager.ts`
- [x] Implement:
  - [x] `isValid(...)`
  - [x] `getIfValid(...)`
  - [x] `save(...)`
  - [x] `clear(...)`
- [x] Include cache version constant
- [x] Add tests `src/cache/evolutionCacheManager.test.ts`

---

## Phase C — Provider Integration

### C1. Settings Plumb-through
- [x] Extend extension settings interface with `evolution.*` fields
- [x] Load defaults in `RepoStatsProvider.getSettings()`
- [x] Handle updates in `updateSettings(...)`

### C2. Message Handling
- [x] Handle `requestEvolutionAnalysis` in `handleWebviewMessage`
- [x] Handle `requestEvolutionRefresh` in `handleWebviewMessage`

### C3. Analysis Runtime
- [x] Add `runEvolutionAnalysis(webview, forceRefresh?)`
- [x] Use evolution cache before analyzing
- [x] Emit lifecycle messages:
  - [x] started
  - [x] progress
  - [x] complete
  - [x] error
- [x] Keep existing `runAnalysis` unchanged

### C4. Refresh Semantics
- [x] Update `refresh()` to clear both caches
- [x] Confirm command `repoStats.refreshStats` invalidates evolution data too

---

## Phase D — Webview Store and Hook Integration

### D1. Store State
- [x] Add evolution state fields to Zustand store:
  - [x] `evolutionData`
  - [x] `evolutionStatus`
  - [x] `evolutionLoading`
  - [x] `evolutionError`
- [x] Add store actions for each state transition

### D2. Message Wiring
- [x] Update `webview-ui/src/hooks/useVsCodeApi.ts` message handler for new evolution messages
- [x] Add API methods:
  - [x] `requestEvolutionAnalysis()`
  - [x] `requestEvolutionRefresh()`

### D3. Store Tests
- [x] Add/extend `webview-ui/src/store/index.test.ts` for evolution transitions

---

## Phase E — Evolution UI Components

### E1. Panel + States
- [x] Create `webview-ui/src/components/evolution/EvolutionPanel.tsx`
- [x] Create state views for:
  - [x] idle (CTA)
  - [x] loading
  - [x] error
  - [x] stale
  - [x] ready

### E2. Controls
- [x] Create `EvolutionControls.tsx` with:
  - [x] dimension selector
  - [x] normalize toggle
  - [x] max series slider
  - [x] rerun button

### E3. Charts
- [x] Create `EvolutionStackChart.tsx`
- [x] Create `EvolutionLineChart.tsx`
- [x] Create `EvolutionDistributionChart.tsx`
- [x] Reuse Plotly theming conventions from current panels

### E4. Styling
- [x] Add `EvolutionPanel.css`
- [x] Match existing extension visual language

---

## Phase F — Configuration + Docs

### F1. VS Code Configuration
- [x] Add `repoStats.evolution.autoRun` to `package.json`
- [x] Add `repoStats.evolution.snapshotIntervalDays`
- [x] Add `repoStats.evolution.maxSnapshots`
- [x] Add `repoStats.evolution.maxSeries`
- [x] Add `repoStats.evolution.cohortFormat`

### F2. Settings UI
- [x] Add evolution settings section under webview settings panel
- [x] Ensure updates persist via existing `updateSettings`

### F3. README
- [x] Add Evolution feature section and screenshot placeholder
- [x] Explain on-demand behavior and stale cache behavior
- [x] Add attribution note (inspired by git-of-theseus style analysis)

---

## Phase G — Testing and Final Validation

### G1. Analyzer Tests
- [x] Add `src/analyzers/evolutionAnalyzer.test.ts`
  - [x] sampling
  - [x] aggregation correctness
  - [x] changed-file reuse

### G2. UI/Store Tests
- [x] Add tests for panel state rendering
- [x] Validate no regressions in existing tests

### G3. Manual QA Checklist
- [x] Small repo: evolution computes correctly
- [x] Large repo: first run tolerable; second run cached and fast
- [x] HEAD changes trigger stale indication
- [x] Recompute clears stale state
- [x] Global refresh clears evolution cache

### G4. Release Gate
- [x] Run `npm run validate`
- [x] Fix all lint/type/test/package issues

---

## Suggested Work Breakdown (PRs)

- [x] **PR 1:** Types + messages + store skeleton + nav wiring
- [x] **PR 2:** Evolution analyzer + cache manager + provider runtime
- [x] **PR 3:** Evolution panel + charts + settings UI
- [x] **PR 4:** Tests + docs + polish + validate

---

## Risks and Mitigations

### Risk: Very slow analysis on huge repos
- Mitigation:
  - [x] enforce sampling defaults
  - [x] cap snapshots
  - [x] cache aggressively
  - [x] explicit on-demand run

### Risk: Memory pressure from histograms
- Mitigation:
  - [x] reuse per-file histograms
  - [x] release intermediate maps after each snapshot
  - [x] cap max series displayed

### Risk: UX confusion between core and evolution analysis
- Mitigation:
  - [x] clear tab-specific messaging
  - [x] separate progress labels
  - [x] idle CTA explains why it is on-demand
