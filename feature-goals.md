# Feature Goals

This document captures product goals and feature directions that fit naturally into the current Repo Stats experience. It is intentionally not a roadmap or delivery plan. Its purpose is to preserve ideas, clarify intent, and guide future implementation choices.

## Positioning

Repo Stats should keep feeling like one coherent tool:
- repository-level overview first
- drill-down views for deeper analysis
- settings that express general concepts rather than one-off toggles
- metrics that are useful both for quick inspection and deeper exploration

New features should extend the current UI model rather than create disconnected side experiences.

## Evolution goals

### Timeline gap handling
Evolution should support a setting that controls whether inactive periods are explicitly shown.

Example:
- activity on day 1, day 3, and day 7
- optional behavior A: show all 7 days with flat carry-forward periods
- optional behavior B: show only the 3 active snapshot days

This should be framed as a clear timeline/gap-handling choice, not an implementation detail.

### Snapshot strategy
Evolution should not be limited to time-based sampling.

Desired snapshot modes:
- time-based snapshots
  - example: every N days
- commit-based snapshots
  - example: every Nth commit
- auto mode
  - produce a sensible number of snapshots across the full repository history
  - example: around 20 evenly distributed snapshots

### Non-linear history clarity
If auto or commit-based sampling creates non-linear spacing in time, the charts should make that understandable.

Potential approaches:
- tooltips that show actual date, commit SHA, and position in history
- axis labels that reflect the real dates of snapshots
- clear language indicating whether spacing is time-based or commit-based

### Evolution settings model
Evolution settings should ideally reflect a few general concepts:
- sampling mode
- sampling density
- maximum snapshots
- timeline gap handling
- cohort grouping format

Prefer this over accumulating unrelated one-off settings.

## Overview goals

### Commit totals
The app should surface the total number of commits more clearly.

### Commits per contributor
The app should include a visual for commit distribution by contributor.

A likely home is the Overview tab, for example as an additional donut/pie-style chart if it integrates cleanly with the existing layout.

### Commit-size metrics
The app should consider contributor-level commit-size metrics such as:
- average lines changed per commit
- potentially median lines changed per commit
- related per-contributor efficiency or change-size summaries where they are actually interpretable

These should be presented carefully so they remain informative rather than misleading.

## Commit analytics goals

### Commit explorer / list view
Add a commit list view that supports filtering and sorting.

Potential filters:
- lines changed
- files changed
- contributor/author
- date range
- commit message text

Potential sortable fields:
- date
- additions
- deletions
- total lines changed
- files changed

This should feel like a natural sibling to the existing Files view: a structured, filterable inspection surface.

### Commit-level derived metrics
Possible future metrics:
- average lines changed per commit
- median lines changed per commit
- largest commits
- commit size distribution
- contributor commit-size patterns

## Product-design goals

### Keep the UI coherent
These additions should fit into the current mental model:
- Overview = repository summary
- Contributors = contributor-focused activity and ownership metrics
- Code Frequency = change volume over time
- Evolution = historical ownership/composition analysis
- Files = file-level structural inspection
- Future Commits view = commit-level inspection

### Prefer reusable concepts over isolated features
When adding settings or metrics, prefer concepts that can apply across views.

Examples:
- gap handling
- granularity
- sampling mode
- ranking metric
- aggregation strategy
- analysis target selection (single repo, repo group, workspace aggregate)

### Multi-repository analysis targets
Features that span submodules or multiple repositories should prefer a shared analysis-target model over one-off toggles.

Examples:
- selected repository
- selected repository + submodules
- workspace repositories
- future custom repository groups

This direction is captured in `MULTI_REPO_ANALYSIS_PLAN.md`.

### Preserve intuitive defaults
Even if advanced settings exist, the default experience should remain simple and sensible for first-time users.

## Notes

These are goals and directions, not commitments to implementation order.
The intention is to keep Repo Stats extensible while preserving a clean and elegant product shape.
