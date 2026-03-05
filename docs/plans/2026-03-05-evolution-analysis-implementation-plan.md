# Evolution Analysis Feature Implementation Plan

**Date:** 2026-03-05  
**Status:** Implemented  
**Feature:** Add on-demand “Evolution” analytics inspired by git-of-theseus concepts

## Goal

Add a new **Evolution** tab to Repo Stats that visualizes how current code ownership evolved over time (cohorts/authors/extensions/directories/domains), while keeping initial dashboard load fast for large repositories.

## Product Decision

Use a **hybrid analysis model**:

- **Global analysis (existing):** runs automatically on dashboard open (overview/contributors/frequency/treemap)
- **Evolution analysis (new):** runs on-demand, separately cached, separately invalidated

This preserves existing UX consistency and avoids adding heavy blame-based analysis to every startup.

---

## Scope

## In Scope (MVP)

1. New `Evolution` navigation tab
2. On-demand analysis execution from webview
3. Separate cache storage and validity checks
4. Three charts:
   - Stacked area over time (selected dimension)
   - Multi-line trend over time (selected dimension)
   - Current distribution bar chart (latest snapshot)
5. Controls:
   - Dimension selector (`cohort`, `author`, `ext`, `dir`, `domain`)
   - Normalize toggle
   - Max series slider
6. Loading/empty/error/stale states for evolution data
7. Settings for sampling and defaults

## Out of Scope (Phase 2)

1. Survival / half-life curve
2. Exponential fitting
3. Mailmap identity merge in analyzer
4. Advanced blame options (`ignore whitespace`, include all file types)

---

## Architecture

## 1) Shared Type Layer

Files:
- `src/types/index.ts`
- `webview-ui/src/types.ts`

Add new interfaces:

- `EvolutionDimension = 'cohort' | 'author' | 'ext' | 'dir' | 'domain'`
- `EvolutionTimeSeriesData`:
  - `ts: string[]` (ISO timestamps)
  - `labels: string[]`
  - `y: number[][]` (series x time)
- `EvolutionResult`:
  - `generatedAt`
  - `headSha`
  - `branch`
  - `settingsHash`
  - `cohorts`
  - `authors`
  - `exts`
  - `dirs`
  - `domains`
- `EvolutionStatus = 'idle' | 'loading' | 'ready' | 'error' | 'stale'`

Extend `AnalysisResult`:
- Do **not** inline full evolution payload in global result
- Keep evolution payload separate to maintain global payload size/speed

## 2) Message Protocol

Extension ↔ Webview messages

Add webview messages:
- `requestEvolutionAnalysis`
- `requestEvolutionRefresh`

Add extension messages:
- `evolutionStarted`
- `evolutionProgress` (`phase`, `progress`)
- `evolutionComplete` (`data: EvolutionResult`)
- `evolutionError` (`error`)
- optional `evolutionStale` (`reason`)

## 3) Analyzer Layer

New file:
- `src/analyzers/evolutionAnalyzer.ts`

Responsibilities:
1. Validate repo
2. Build sampled commit timeline
3. For each sampled commit, compute ownership histograms
4. Build plot-ready timeseries for each dimension
5. Report progress callback

Key algorithm design:

1. Gather commits along first-parent lineage (active branch)
2. Sample by interval (`snapshotIntervalDays`) and cap (`maxSnapshots`)
3. For each sampled commit:
   - list tracked files / tree entries
   - detect changed files via blob SHA map diff from previous snapshot
   - run blame only for changed files
   - reuse previous file histogram for unchanged files
4. Aggregate per-file histograms into global totals for snapshot
5. Append totals into each dimension series

Dimension keys per blamed line:
- cohort: commit date format (default `%Y`)
- author: blame author name
- ext: file extension
- dir: top-level directory
- domain: author email domain

## 4) Cache Layer

New file:
- `src/cache/evolutionCacheManager.ts` (recommended)

Why separate manager:
- avoids bloating current `CacheManager`
- explicit versioning/invalidation for heavy data

Cache identity:
- repo hash
- `headSha`
- `branch`
- evolution settings hash
- evolution cache version

Validity criteria:
- cache version matches
- headSha matches
- settings hash matches

Stale policy:
- if head changed and old evolution cache exists, UI may show stale data until recompute

## 5) VSCode Provider Integration

File:
- `src/webview/provider.ts`

Changes:
1. Handle new message types in `handleWebviewMessage`
2. Add `runEvolutionAnalysis(webview, forceRefresh)` method
3. Keep current `runAnalysis` untouched
4. On global refresh command:
   - clear global cache
   - clear evolution cache
5. Load/send settings relevant to evolution defaults

## 6) Webview Store and UI

Store file:
- `webview-ui/src/store/index.ts`

Add state:
- `evolutionData: EvolutionResult | null`
- `evolutionStatus: EvolutionStatus`
- `evolutionLoading: { phase, progress }`
- `evolutionError: string | null`

UI files:
- `webview-ui/src/components/evolution/EvolutionPanel.tsx`
- `EvolutionControls.tsx`
- `EvolutionStackChart.tsx`
- `EvolutionLineChart.tsx`
- `EvolutionDistributionChart.tsx`
- `EvolutionStateView.tsx` (empty/loading/error/stale cards)
- `EvolutionPanel.css`

Navigation/App changes:
- add `evolution` to `ViewType`
- add nav item in `Navigation.tsx`
- render panel in `App.tsx`

---

## Settings

## New configuration keys

In `package.json` and settings plumbing:

- `repoStats.evolution.autoRun` (boolean, default `false`)
- `repoStats.evolution.snapshotIntervalDays` (number, default `30`)
- `repoStats.evolution.maxSnapshots` (number, default `80`)
- `repoStats.evolution.maxSeries` (number, default `20`)
- `repoStats.evolution.cohortFormat` (string, default `"%Y"`)

Optional safety limits:
- min/max validation for snapshots and interval in analyzer

---

## Performance Strategy

1. **On-demand only** for heavy pipeline
2. **Sampling** snapshots instead of every commit
3. **Diff-aware blame reuse** (only changed files recomputed)
4. **Hard caps** (`maxSnapshots`, max files failsafe)
5. **Progress feedback** throughout run
6. **Persist cache** by HEAD+settings

Expected UX:
- small repo: near-immediate
- medium/large repo: noticeable first run, fast subsequent runs from cache

---

## UX States for Evolution Tab

1. `idle` (no data yet):
   - Explain what analysis does
   - Show estimated cost note
   - CTA: “Run Evolution Analysis”
2. `loading`:
   - progress bar + current phase text
   - allow cancel later (optional)
3. `ready`:
   - render controls + charts
4. `stale`:
   - show banner “Repository changed since last Evolution analysis”
   - CTA: “Recompute”
5. `error`:
   - error card + retry button

---

## Licensing / Attribution

- Do not copy source code from `better-git-of-theseus`
- Implement independently in TypeScript
- Add README note: “Evolution view inspired by git-of-theseus style repository evolution analysis.”

---

## Testing Plan

## Unit tests

1. `src/analyzers/evolutionAnalyzer.test.ts`
   - commit sampling behavior
   - dimension aggregation correctness
   - changed-file reuse logic
   - progress callback emission
2. `src/cache/evolutionCacheManager.test.ts`
   - save/load/isValid/clear
   - head/settings invalidation
3. `webview-ui/src/store/index.test.ts`
   - evolution message state transitions

## UI tests (basic)

- evolution panel renders idle/loading/ready/error states
- controls update chart inputs

## Manual validation

- run on small repo and large repo
- verify first run slow, second run cached fast
- verify stale banner after new commit

Final quality gate:
- run `npm run validate`

---

## Rollout Plan

## Milestone 1 (Backend skeleton)
- types + messages + analyzer scaffold + provider plumbing + cache manager scaffold

## Milestone 2 (Functional MVP)
- analyzer outputs real data + evolution tab renders all three charts

## Milestone 3 (Stability)
- tests + perf tuning + docs + settings UI

---

## Acceptance Criteria

1. Dashboard opens with existing speed profile when evolution not requested
2. Evolution tab can run analysis on-demand and show progress
3. Evolution results persist and reload from cache for same HEAD/settings
4. Stale state shown after repo HEAD changes
5. User can rerun evolution explicitly
6. `npm run validate` passes
7. README + settings docs updated
