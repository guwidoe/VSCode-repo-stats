# Overview Stats Panel Design

## Summary

Add a new "Overview" tab as the first tab in the navigation, showing general repository statistics: total files, lines of code, and size with expandable breakdowns.

## Scope

- **Files** - Total count, breakdown by file extension (expandable)
- **Lines of Code** - Total LOC, breakdown by language (expandable)
- **Size** - Total repo size, largest files (expandable)

## Data Source

Reuse existing `fileTree` from `AnalysisResult`. Frontend-only aggregation, no backend changes.

## Files to Create

- `webview-ui/src/components/overview/OverviewPanel.tsx` - Main panel
- `webview-ui/src/components/overview/StatSection.tsx` - Reusable expandable section
- `webview-ui/src/components/overview/OverviewPanel.css` - Styles
- `webview-ui/src/hooks/useOverviewStats.ts` - Data aggregation hook

## Files to Modify

- `webview-ui/src/types.ts` - Add `'overview'` to `ViewType`
- `webview-ui/src/components/Navigation.tsx` - Add Overview as first tab
- `webview-ui/src/App.tsx` - Render `OverviewPanel` when active

## UI Layout

### Collapsed State
```
┌─────────────────────────────────────────────────┐
│ Files                                 1,234  ▶ │
├─────────────────────────────────────────────────┤
│ Lines of Code                        45,678  ▶ │
├─────────────────────────────────────────────────┤
│ Size                                 2.3 MB  ▶ │
└─────────────────────────────────────────────────┘
```

### Expanded State (Lines of Code example)
```
┌─────────────────────────────────────────────────┐
│ Lines of Code                        45,678  ▼ │
│  ┌────────────────────────────────────────────┐ │
│  │ TypeScript     ████████████░░░  28,450 62% │ │
│  │ CSS            ████░░░░░░░░░░░   8,200 18% │ │
│  │ JSON           ███░░░░░░░░░░░░   5,100 11% │ │
│  │ Markdown       ██░░░░░░░░░░░░░   2,400  5% │ │
│  │ Other          █░░░░░░░░░░░░░░   1,528  4% │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Data Structure

```typescript
interface OverviewStats {
  files: {
    total: number;
    byExtension: { ext: string; count: number }[];
  };
  loc: {
    total: number;
    byLanguage: { language: string; lines: number }[];
  };
  size: {
    totalBytes: number;
    largestFiles: { path: string; lines: number }[];
  };
}
```

## Implementation Notes

- Single recursive traversal of `fileTree`
- Memoized with `useMemo`
- Groups sorted by count/size descending
- "Other" category for items beyond top 5
- Simple CSS horizontal bars (no charting library)
