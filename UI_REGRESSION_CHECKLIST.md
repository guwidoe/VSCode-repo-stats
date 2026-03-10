# UI Regression Checklist

Use this checklist before shipping UI-heavy changes that touch responsive layout, commit analytics presentation, or Evolution charts.

## Overview
- [ ] Narrow the webview until the top Overview stats collapse from 4-up to a centered 2x2 layout.
- [ ] Narrow further until the stats collapse to a single column.
- [ ] Confirm no horizontal overflow appears in the Overview stats row.
- [ ] Confirm Overview metric cards use proper icons rather than emoji/fallback glyphs.
- [ ] Confirm the total commit count matches the real repository history for a large repo.

## Navigation
- [ ] Shrink the window until the top navigation overflows.
- [ ] Confirm overflowed tabs move into the overflow menu and remain reachable.
- [ ] Confirm active-state styling still works for visible tabs and overflowed tabs.
- [ ] Confirm header tab icons render correctly on the current platform/theme.

## Commits tab
- [ ] Open Commits in a large repo and confirm the panel remains responsive while loading.
- [ ] Confirm the main experience is a table/grid, not a wall of filter cards.
- [ ] Click several commit column headers and verify sort order changes immediately.
- [ ] Open header filter popovers for date, author, summary, and numeric columns.
- [ ] Confirm filtered results update and the `Clear filters` action resets the table.
- [ ] Expand the insights section and confirm charts render for:
  - [ ] changed-lines distribution
  - [ ] files-changed distribution
  - [ ] contributor commit-size patterns
  - [ ] largest commits
- [ ] Confirm commit summary cards use proper icons rather than emoji/fallback glyphs.

## Code Frequency
- [ ] Open Code Frequency and confirm the x-axis does not start at 1970.

## Evolution
- [ ] Hover line and stacked charts near the right and bottom edges of the webview.
- [ ] Confirm tooltips stay readable and do not become giant overflowing unified hover panels.
- [ ] Toggle `X-axis view` between `Calendar time` and `Commit progression` without recomputing analysis.
- [ ] Confirm the timeline note updates to explain the active x-axis mode.
- [ ] Enable inactive periods and confirm charts no longer turn into stair-step carry-forward plots.
- [ ] Confirm the inactive-period explanation still makes sense after the chart change.

## General
- [ ] Run `npm run validate`.
- [ ] If any visual behavior changed materially, capture before/after screenshots for the PR or release notes.
