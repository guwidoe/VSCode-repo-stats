# Fallback Audit TODO

Context: classify and fix fallback behavior so it does **not hide bugs/misconfiguration**.

## Rules (agreed)

- Settings-load fallbacks are **bad by default**.
- Defaults should be user-visible in VS Code config schema, not hidden ad-hoc in runtime code.
- Silent failure is forbidden unless failure is expected a priori and explicitly documented.
- Data-shape fallbacks are only acceptable if partial data is expected by contract.

---

## P0 — Remove bad settings fallbacks (hidden behavior)

- [x] **Stop using UI-level fallback for generated patterns**
  - Files:
    - `webview-ui/src/hooks/useOverviewStats.ts` (`settings?.generatedPatterns ?? DEFAULT_GENERATED_PATTERNS`)
    - `webview-ui/src/hooks/useFileCatalog.ts` (`settings?.generatedPatterns ?? DEFAULT_GENERATED_PATTERNS`)
  - Why bad: hides settings load failures.
  - Fix: require `settings` to be loaded before computing stats/catalog; render loading/empty state until settings are present.

- [x] **Stop using UI-level fallback for tooltip settings**
  - File: `webview-ui/src/components/treemap/TreemapTooltip.tsx` (`settings?.tooltipSettings ?? DEFAULT_TOOLTIP_SETTINGS`)
  - Why bad: masks missing settings propagation.
  - Fix: treat missing tooltip settings as configuration error; either block render with explicit message or enforce non-null settings contract from store.

- [x] **Remove optional-setting fallbacks in UI where settings are expected to exist**
  - Files:
    - `webview-ui/src/components/frequency/CodeFrequencyPanel.tsx` (`?? true`)
    - `webview-ui/src/components/contributors/CommitsChart.tsx` (`?? true`)
    - `webview-ui/src/components/contributors/TimeRangeSlider.tsx` (`?? true`)
    - `webview-ui/src/components/overview/OverviewPanel.tsx` (`?? 'percent'`)
    - `webview-ui/src/components/evolution/EvolutionPanel.tsx` (`?? 20`)
    - `webview-ui/src/components/settings/ChartsSettings.tsx` (`|| 'auto'`, `|| 20`)
    - `webview-ui/src/components/settings/TreemapSettings.tsx` (`?? false`)
    - `webview-ui/src/components/settings/GeneralSettings.tsx` (`|| []`)
  - Why bad: these hide missing/invalid settings wiring.
  - Fix: make `settings` required in these components (or gate rendering in parent until loaded).

---

## P0 — Remove hidden runtime defaults in extension settings loader

- [x] **Eliminate duplicate runtime defaults in `getSettings()`**
  - File: `src/webview/provider.ts` (`config.get(..., default)` for almost every setting)
  - Why bad: defaults are already defined in `package.json` contributes configuration; runtime defaults hide schema/config drift.
  - Fix:
    1. Read config without hardcoded fallback (or with a strict helper).
    2. Validate presence/type explicitly.
    3. If missing/invalid, throw clear error pointing to configuration key.

- [x] **Keep defaults in one source of truth**
  - File: `package.json` (`contributes.configuration.properties.*.default`)
  - Fix: document this as canonical defaults source; avoid re-declaring defaults in TS unless generated from schema.

---

## P0 — Remove silent unexpected failure fallbacks

- [x] **Do not silently swallow blame analysis failure**
  - File: `src/analyzers/coordinator.ts` (`analyzeHeadBlameMetrics(...).catch(() => createEmptyBlameMetrics())`)
  - Why bad: hides broken blame pipeline entirely.
  - Fix: propagate error OR emit structured warning to UI + logs; if partial mode is desired, make it explicit (`blameStatus: degraded`, reason, counts).

- [x] **Stop silent/empty fallback for git metadata commands**
  - File: `src/analyzers/gitAnalyzer.ts`
    - `getFileModificationDates()` catch returns empty map
    - `getTrackedFiles()` catch returns `[]`
    - `getSubmodulePaths()` catch returns `[]`
  - Why bad: unexpected failures become invisible and alter results silently.
  - Fix: return `Result` with explicit error/degraded state or throw and surface actionable message.

- [x] **Stop best-effort silent staleness check failure**
  - File: `src/webview/provider.ts` (`sendStalenessStatus` catch)
  - Why bad: staleness logic can break unnoticed.
  - Fix: at least log warning with context; optionally notify UI with `stalenessUnknown` state.

- [x] **Review per-file blame swallow in evolution analysis**
  - File: `src/analyzers/evolutionAnalyzer.ts` (`computeFileHistogram` catch returns empty histogram)
  - Why risky: may hide systemic blame failures.
  - Fix: keep per-file tolerance only for expected cases; aggregate and report skip/error counts, fail when error rate exceeds threshold.

---

## P1 — Validate questionable value fallbacks

- [x] **`parseColor` gray fallback should be explicit error path**
  - File: `webview-ui/src/components/treemap/utils/colors.ts` (default gray)
  - Why risky: invalid color inputs should be detected during development.
  - Fix: in dev/test throw on invalid color; in prod log + fallback with telemetry counter.

- [x] **`LoadingState` phase fallback string**
  - File: `webview-ui/src/components/common/LoadingState.tsx`
  - Why questionable: may hide missing progress phase wiring.
  - Fix: require phase from producer, or explicitly mark unknown phase (`"(phase missing)"`) in dev.

- [x] **Name fallback `unknown` in cache/repo display**
  - Files:
    - `src/analyzers/gitAnalyzer.ts`
    - `src/cache/cacheManager.ts`
  - Why questionable: can conceal malformed repo path handling.
  - Fix: assert non-empty repo name or surface explicit error.

---

## P1 — Data-shape fallbacks: keep only where contract says partial is expected

- [x] **Audit all `node.lines || 0`, `children || []`, etc. and document contract**
  - Scope: analyzers + webview hooks/store/components.
  - Fix: tighten `TreemapNode` typing where possible (separate `FileNode`/`DirectoryNode`), reduce defensive fallback usage.

- [x] **Replace `||` with `??` where `0` is valid and should not trigger fallback**
  - Scope: numeric fallbacks that currently coerce `0` to default.
  - Fix: switch to nullish checks and add tests for zero values.

---

## P2 — Tests (avoid masking failures)

- [x] **Review test fallbacks that can hide fixture issues**
  - Files:
    - `src/analyzers/evolutionAnalyzer.test.ts` (`?? ''`)
    - `webview-ui/src/store/index.test.ts` (`|| []`)
  - Fix: only keep fallback if unrelated to test intent; otherwise fail loudly on missing fixture data.

---

## Implementation notes

- [x] Add a shared helper for strict config reads (type-safe + explicit errors).
- [x] Add degraded-state telemetry/reporting object for optional subsystems (blame/evolution metadata), instead of silent empties.
- [x] Add lint rule/checklist for disallowing silent catch + empty fallback in production code.
- [x] Add regression tests for “settings not loaded” and “unexpected command failure” paths (must surface, not hide).
