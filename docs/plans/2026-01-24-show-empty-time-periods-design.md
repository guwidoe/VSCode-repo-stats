# Show Empty Time Periods Feature Design

**Date:** 2026-01-24
**Status:** Implemented

## Problem

Charts in the extension (CommitsChart, CodeFrequencyPanel, TimeRangeSlider background) were skipping weeks/months with no activity. This made the timeline appear compressed and could mislead users about the actual time elapsed between periods of activity.

## Solution

Added a new setting "Show empty time periods" that fills in gaps with zero-valued entries when enabled.

### Setting

- **Name:** `repoStats.showEmptyTimePeriods`
- **Type:** boolean
- **Default:** `true` (show gaps)
- **Description:** Display weeks/months with no activity in charts

### Implementation

1. **Utility functions** ([fillTimeGaps.ts](../../webview-ui/src/utils/fillTimeGaps.ts)):
   - `fillWeeklyGaps()` - fills missing weeks in weekly data
   - `fillMonthlyGaps()` - fills missing months in monthly data
   - Supporting functions for parsing/generating ISO weeks and months

2. **Affected components:**
   - `CommitsChart` - contributor commits over time graph
   - `TimeRangeSlider` - background activity mini-chart
   - `CodeFrequencyPanel` - additions/deletions over time graph

3. **Settings integration:**
   - Added to `ExtensionSettings` interface
   - Added to VSCode configuration in `package.json`
   - Toggle in Settings panel using existing `SelectSetting` component

### Data Flow

```
Store (sparse data) → Component reads setting → fillTimeGaps() if enabled → Chart renders
```

Gap filling happens at render time in each component, keeping store data unchanged for efficient caching and filtering.

## Trade-offs

- **Memory:** Gap-filled arrays may be larger than sparse data for repositories with sporadic activity
- **Performance:** Gap filling is O(n) where n is the number of time periods; negligible for typical repository sizes
- **TimeRangeSlider complexity:** Maintains mapping between sparse indices (for filtering) and filled indices (for display)
