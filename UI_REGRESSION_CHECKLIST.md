# UI Regression Checklist

Use this checklist before shipping UI-heavy changes.

## Header + navigation
- [ ] Confirm the header renders the current analysis selection summary.
- [ ] Open the repository selector and verify checkbox states match the current selection.
- [ ] Click `All`, `Top-level`, and `None` in the selector and verify summaries update correctly.
- [ ] Verify the Refresh button is disabled while analysis is running.
- [ ] Shrink the webview until top navigation overflows.
- [ ] Confirm overflowed tabs move into the overflow menu and remain reachable.
- [ ] Confirm active-state styling works for both visible and overflowed tabs.

## Overview
- [ ] Confirm all overview donut charts render (language, file types, commits by contributor, ownership, line age).
- [ ] Confirm chart row wraps responsively without horizontal overflow on narrow widths.
- [ ] Confirm unknown-file-type chips render and `Show more` / `Show less` works.
- [ ] Confirm binary file category counts and extension lists render correctly.
- [ ] With multiple repositories selected, confirm the `Analysis Target` section appears and lists member repositories.

## Files
- [ ] Confirm the file table renders and remains responsive on a large repo.
- [ ] Verify per-column filtering works (text, number range, boolean, date).
- [ ] Verify sorting and clear-filters behavior.

## Commits
- [ ] Open Commits in a large repo and confirm the panel remains responsive while loading.
- [ ] Click several commit column headers and verify sort order changes.
- [ ] Open header filter popovers for date, author, summary, and numeric columns.
- [ ] Confirm filtered results update and `Clear filters` resets the table.
- [ ] Expand insights and confirm charts render for changed-lines distribution, files-changed distribution, contributor commit-size patterns, and largest commits.

## Contributors + Code Frequency
- [ ] Confirm Contributors chart and time-range controls render correctly.
- [ ] Confirm Code Frequency x-axis does not start at 1970 and granularity toggles correctly.

## Evolution
- [ ] Trigger Evolution recompute and confirm loading state shows stage, repository progress, snapshot progress, and ETA.
- [ ] Confirm Evolution stale-state messaging appears after relevant repo/settings changes.
- [ ] Hover line and stacked charts near edges and confirm tooltips remain readable.
- [ ] Toggle `X-axis view` between `Calendar time` and `Commit progression` without recomputing.
- [ ] Confirm inactive-period toggles behave correctly.

## General
- [ ] Run `npm run validate`.
- [ ] If visual behavior changed materially, capture before/after screenshots for the PR or release notes.
