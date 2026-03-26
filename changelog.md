# Changelog

This changelog was reconstructed retroactively from the repository's version bumps and commit history.

## Unreleased

- No unreleased changes yet.

## 1.4.4 - 2026-03-26

- Replaced the Code Frequency time period dropdown with a contributor-style range slider that previews additions and deletions inline.
- Improved Code Frequency range selection responsiveness on large repositories by using asynchronous slider updates while the main chart catches up.

## 1.4.3 - 2026-03-25

- Added cancellable analysis runs, including dashboard cancel actions and cancellation checks in the analysis and evolution pipelines.
- Streamed aggregate workspace results and tracked preliminary result metadata so multi-repo analyses can surface progress earlier.
- Kept the dashboard and evolution charts visible during refresh and recompute instead of blanking the UI.
- Added regression coverage for the provisional/live-analysis banner flow.

## 1.4.2 - 2026-03-25

- Updated evolution commit sampling to use snapshot counts for more representative history selection.

## 1.4.1 - 2026-03-24

- Hardened webview message contracts, repository identity handling, and typed settings flow.
- Surfaced repository discovery failures more honestly instead of silently masking them.
- Excluded local desloppify artifacts from packaged builds and moved generated VSIX files under `dist/vsix`.
- Refactored providers, analysis, evolution, benchmarks, and webview state into smaller modules while preserving behavior.
- Restored publish-install compatibility by pinning ESLint to v8 and refreshed the dependency set.

## 1.4.0 - 2026-03-19

- Added repository-target selection for aggregated analysis.
- Added target-aware evolution aggregation across selected repository members.
- Improved analysis progress reporting with snapshot-level and richer loading details.
- Fixed dashboard startup so the webview opens reliably before target initialization completes.
- Improved extension-host development builds for the bundled webview.

## 1.3.9 - 2026-03-12

- Added bookmarked repository support to the repository selector.
- Refreshed the dependency set for the extension and webview toolchain.

## 1.3.8 - 2026-03-10

- Defaulted evolution sampling mode to `auto`.

## 1.3.7 - 2026-03-10

- Added a reusable viewport-aware tooltip surface for dense UI interactions.

## 1.3.6 - 2026-03-10

- Simplified the overview by removing the top summary cards.
- Kept the commits columns popover inside the viewport and enforced a minimum visible list height.

## 1.3.5 - 2026-03-10

- Improved overview stat wrapping and responsive collapse behavior.
- Improved table column controls and viewport sizing.

## 1.3.4 - 2026-03-10

- Restored expressive tab icons and reordered tabs to better match the analysis workflow.
- Restored overview card icons and the `2x2` stat-card layout.
- Improved commit chart label contrast and guarded submodule typing in overview rendering.

## 1.3.3 - 2026-03-10

- Added configurable treemap age color ranges.

## 1.3.2 - 2026-03-10

- Fixed repository commit counting and made overview metric cards properly responsive.
- Redesigned the commits view around a table-first workflow with improved summaries.
- Improved evolution tooltip gap handling and axis controls.
- Standardized tab icons and introduced a shared table shell for data-heavy views.

## 1.3.1 - 2026-03-09

- Added an analysis performance benchmark workflow and hardened the remote benchmark runner.
- Redesigned commits filters and insights, virtualized large result lists, and fixed repository totals.
- Improved navigation responsiveness with an overflow menu and cleaner tab icons.
- Fixed overview and frequency layout issues on smaller viewports.

## 1.3.0 - 2026-03-09

- Added a filterable commit explorer with derived analytics views.
- Added commit-size metrics plus commit distribution and total-commit insights to the overview.
- Added evolution snapshot sampling modes and inactive-period gap handling.
- Shared contracts and settings logic across the extension and webview layers.
- Excluded Pi local state from packaged extension artifacts.

## 1.2.0 - 2026-03-09

- Added multi-repository selection for workspace analysis.
- Added treemap repository exclude actions and clamped context menus to the visible viewport.

## 1.1.4 - 2026-03-09

- Preserved snapshot time granularity in evolution analysis.
- Fixed CI to compile the extension before running integration tests.

## 1.1.3 - 2026-03-07

- Added repo-scoped settings metadata and controls, including history-related settings.
- Applied exclude patterns consistently across analysis and root-level generated-pattern matching.
- Marked views stale after relevant setting changes and normalized binary-extension handling.

## 1.1.2 - 2026-03-06

- Added evolution snapshot granularity presets.
- Fixed single-segment donut rendering in the overview.

## 1.1.1 - 2026-03-06

- Added clickable file names and paths in the Files view.
- Polished Files header layout and removed duplicate scrolling behavior.
- Restored the publish trigger and hardened CI validation/install flow.
- Refreshed screenshots and excluded local virtualenvs from VSIX packaging.

## 1.1.0 - 2026-03-05

- Added the Evolution tab with analyzer, cache, charts, settings UI, and supporting tests.
- Added the Files tab with a virtualized sortable table, richer HEAD blame metrics, filters, and resizable columns.
- Added optional submodule inclusion for overview and treemap analysis.
- Added `repoStats.locExcludedExtensions` for finer LOC filtering.
- Hardened settings and fallback handling so analysis failures and diagnostics are surfaced more honestly.
- Upgraded major portions of the webview and tooling stack, including VS Code engine/types alignment.

## 1.0.1 - 2026-01-29

- Expanded the treemap with complexity and density modes, richer tooltips, a collapsible tree view, and metric documentation.
- Synced tree view selection with treemap clicks and improved treemap controls/settings.
- Improved the settings and overview tabs and invalidated stale cache data for the new metrics.

## 1.0.0 - 2026-01-24

- Initial public release of Repo Stats for VS Code.
- Added repository dashboards for contributors, overview statistics, and treemap exploration.
- Added treemap filtering, presets, language-aware coloring, nested hierarchy rendering, and auto-resize behavior.
- Added an Overview page and extension settings tab.
- Added automatic `scc` download for more consistent LOC counting.
- Added packaging/publishing workflow, project documentation, and extension branding assets.
