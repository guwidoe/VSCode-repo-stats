# VSCode Repo Stats - Feature Specification

## Overview

A VSCode extension that visualizes repository statistics with three main views:
1. **Contributors Dashboard** - LOC per contributor, commits over time (like GitHub Insights)
2. **Code Frequency Graph** - Additions/deletions over time
3. **Repository Treemap** - Visual map of codebase by lines of code (like WizTree)

Technical architecture and data models are documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Contributors View

### Purpose
Show who contributes to the repository and how their contributions are distributed over time.

### Features

**Time Period Filter**
- Options: "All", "Last Year", "Last 6 Months", "Last 3 Months", "Last Month"
- Affects both the aggregate chart and contributor cards
- Default: "All"

**Aggregate Commits Chart**
- Bar chart showing total commits per week across all contributors
- X-axis: time (weeks)
- Y-axis: number of commits
- Includes brush/zoom selector below main chart for navigating large time ranges

**Contributor Cards**
- Displayed in a responsive grid (2-4 columns depending on viewport)
- Sorted by total commits (descending)
- Each card shows:
  - Initials avatar with generated background color (from email hash)
  - Display name
  - Rank badge (#1, #2, etc.)
  - Commit count
  - Lines added (green) and deleted (red)
  - Mini sparkline of their commit activity over time

**Card Interactions**
- Hover: Subtle highlight
- Click: Could expand to show more details (optional enhancement)

---

## 2. Code Frequency View

### Purpose
Visualize the rate of code changes over time - additions vs deletions per time period.

### Features

**Granularity Toggle**
- Options: "Weekly" (default), "Monthly"
- User can switch between views

**Bar Chart**
- Green bars pointing UP = additions
- Red bars pointing DOWN = deletions
- X-axis: time periods (weeks or months)
- Y-axis: lines of code (positive for additions, negative for deletions)

**Interactions**
- Hover on bar: Tooltip showing exact numbers for that period (week/month, additions, deletions, net change)
- Zoom: Mouse wheel or pinch to zoom into time range
- Pan: Click and drag to pan
- Reset: "Reset zoom" button to return to full view

---

## 3. Treemap View

### Purpose
Visualize the repository structure with each file/folder sized by lines of code, similar to WizTree disk visualization.

### Features

**Color Modes**
Two toggleable modes:

1. **By Language** (default)
   - Each file colored by programming language
   - Uses GitHub linguist-style color palette
   - Examples: TypeScript = #3178c6, JavaScript = #f1e05a, Python = #3572A5

2. **By Age**
   - Heat map based on last modified date
   - Green = recently modified (< 1 month)
   - Yellow = medium age (1-6 months)
   - Orange/Red = older files (6+ months without changes)

**Box Sizing**
- Each rectangle sized proportionally to Lines of Code
- Directories aggregate their children's LOC
- Uses squarified treemap algorithm for good aspect ratios

**Breadcrumb Navigation**
- Shows current path: `root / src / components`
- Click any segment to navigate back up
- Clicking root shows entire repository

**Interactions**

| Action | Behavior |
|--------|----------|
| **Hover** | Show tooltip with: filename, full path, LOC, language, last modified |
| **Click file** | Open file in VSCode editor |
| **Click directory** | Zoom into directory (fills viewport with its contents) |
| **Breadcrumb click** | Navigate to that level |
| **Right-click** | Context menu with: "Open File", "Reveal in Explorer", "Copy Path" |

**Tooltip Content**
Always visible on hover, positioned near cursor:
- File name (bold)
- Full path from repo root
- Lines of code
- Programming language
- Last modified (relative, e.g., "3 days ago")

---

## Extension Commands

| Command | Palette Text | Description |
|---------|--------------|-------------|
| `repoStats.showDashboard` | "Repo Stats: Show Dashboard" | Opens the statistics dashboard |
| `repoStats.refreshStats` | "Repo Stats: Refresh" | Re-analyzes repository (clears cache) |

---

## User Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `repoStats.excludePatterns` | array | `["node_modules", "vendor", ".git", "dist", "build"]` | Glob patterns to exclude from analysis |
| `repoStats.maxCommitsToAnalyze` | number | `10000` | Maximum commits to analyze (performance limit for large repos) |
| `repoStats.defaultColorMode` | enum | `"language"` | Default treemap color mode: `"language"` or `"age"` |

---

## Edge Cases & Error States

### No Git Repository
- Show friendly message: "This folder is not a Git repository"
- Suggest: "Open a folder containing a Git repository to view statistics"

### Empty Repository
- Show message: "This repository has no commits yet"

### Analysis In Progress
- Show loading indicator with progress text
- "Analyzing repository... (this may take a moment for large repos)"
- Consider progressive loading: show available data as it becomes ready

### Large Repository Warning
- If repo has >50,000 files, show warning before analysis
- Option to proceed or cancel

### Missing scc Binary
- Graceful fallback or clear error message
- Link to manual installation instructions

---

## Acceptance Criteria

### Contributors View
- [ ] Shows aggregate commits chart over time
- [ ] Displays contributor cards with correct stats
- [ ] Time period filter works correctly
- [ ] Cards sorted by commit count

### Code Frequency View
- [ ] Shows additions (green up) and deletions (red down)
- [ ] Weekly/monthly toggle works
- [ ] Hover tooltips show exact numbers
- [ ] Zoom and pan work smoothly

### Treemap View
- [ ] Files sized by LOC
- [ ] Language color mode shows correct colors
- [ ] Age color mode shows correct heat map
- [ ] Click file opens it in editor
- [ ] Click directory zooms in
- [ ] Breadcrumb navigation works
- [ ] Tooltip shows all required information
- [ ] Right-click context menu works

### General
- [ ] Extension activates without errors
- [ ] Dashboard opens from command palette
- [ ] Refresh command works
- [ ] Settings are respected
- [ ] Works on Windows, macOS, and Linux
