# Files Tab Implementation Plan

Date: 2026-03-05
Owner: Repo Stats webview
Status: Planned

## Goal

Replace the Overview panel's **"Largest Code Files (excluding generated)"** block with a dedicated **Files** tab that:

- shows a full file list for the repository,
- exposes metadata columns (LOC, size, language, generated/binary flags, etc.),
- supports high-performance filtering and sorting on large repositories,
- defaults to LOC-desc sorting to preserve current "largest files" behavior.

## Decisions (confirmed)

1. **Default dataset**: show **all files** by default.
   - Rationale: maximum generality.
   - Generated/binary/code metadata remains visible + filterable.

2. **Sorting in v1**: support multi-column sorting via stable sort chaining.
   - Rationale: sufficient for v1 complexity.
   - UX: single click toggles direction; shift-click appends sort key.

3. **Dependencies**: adding dependencies is acceptable.
   - Plan: use a virtualization library for predictable performance.

## User-facing changes

### Navigation

- Add new main nav tab: **Files**.
- Keep existing tabs unchanged.

### Overview

- Remove "Largest Code Files" section from Overview panel.
- Keep all existing Overview charts/cards.

### Files tab (new)

#### Core table

Columns (v1):

- Path
- Name
- Extension
- Language
- LOC
- Size (bytes, formatted)
- Generated (boolean)
- Binary (boolean)
- Optional if available in data:
  - Complexity
  - Comment lines
  - Blank lines
  - Last modified

#### Filters

- Global text search (path + name)
- Language multi-select
- Extension multi-select
- Numeric ranges:
  - LOC min/max
  - Size min/max
- Boolean toggles:
  - generated only / exclude generated
  - binary only / hide binary
  - code only

#### Sorting

- Default: `LOC desc`
- Click column header: toggle `asc/desc`
- Shift-click additional headers: append stable sort keys
- Clear sort resets to default (`LOC desc`)

## Non-functional requirements

- Smooth interaction for large repos (10k-100k+ files).
- No visible UI jank when typing filter queries.
- Avoid repeated full tree traversals on every interaction.

## Technical design

## 1) Data model + flattening

Create `useFileCatalog` hook to flatten `fileTree` once (memoized by `data.fileTree` + settings relevant to classification).

Proposed row type:

```ts
interface FileRow {
  path: string;
  name: string;
  ext: string;
  language: string;
  lines: number;
  bytes: number;
  binary: boolean;
  generated: boolean;
  isCode: boolean;
  complexity?: number;
  commentLines?: number;
  blankLines?: number;
  lastModified?: string;

  // precomputed for filter performance
  pathLower: string;
  nameLower: string;
}
```

Also expose precomputed filter option lists:

- `languages: string[]`
- `extensions: string[]`

## 2) Shared classification utility

Extract reusable helpers from `useOverviewStats` into a shared utility (e.g. `webview-ui/src/utils/fileClassification.ts`):

- `getFileExtension(...)`
- `globToRegex(...)`
- `isGeneratedFile(...)`

Ensure Files and Overview use identical classification behavior.

## 3) Filtering + sorting pipeline

Implement a pure pipeline over `FileRow[]`:

1. filter pass (text/select/range/boolean)
2. stable multi-sort pass
3. virtualization slice handled at render layer

Performance notes:

- Use `useMemo` keyed by rows + filter/sort state.
- Debounce text search (~120ms).
- Use typed comparators and `Intl.Collator` for strings.
- Keep sort stable by preserving original index tie-breaker.

## 4) Virtualized table

Adopt a virtualization library (recommended: `@tanstack/react-virtual`).

Why:

- reliable large-list rendering,
- simpler than custom windowing,
- minimal maintenance burden.

## 5) State location

Use local component state for Files-tab-specific UI state unless reused elsewhere.

Keep Zustand global store changes minimal:

- add `'files'` to `ViewType`
- add navigation + app routing for Files panel

## Implementation steps

1. **Scaffold view plumbing**
   - Update `ViewType` with `files`
   - Add Files nav item
   - Render `FilesPanel` in `App.tsx`

2. **Create shared classification util**
   - Move/reuse generated/ext helpers
   - Update `useOverviewStats` to consume shared util

3. **Build `useFileCatalog` hook**
   - Flatten tree
   - Compute flags/normalized fields
   - Export filter options

4. **Implement Files panel UI**
   - Filter toolbar
   - Sortable headers
   - Virtualized body
   - Empty-state + result count

5. **Remove largest-files block from Overview**
   - Remove JSX + CSS
   - Remove `largestFiles` from overview stats output if no longer needed

6. **Copy updates (About/help text)**
   - Replace "largest files" mention with "Files tab"

7. **Tests**
   - Hook unit tests (flatten/filter/sort)
   - Files panel behavior tests
   - Navigation regression tests
   - Overview regression after removing largest-files block

8. **Validation gate**
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run validate`

## Testing strategy

### Unit tests

- `useFileCatalog`:
  - flatten correctness
  - generated/binary/code flags
  - option lists
- filter pipeline:
  - text + column filters combine correctly
  - numeric bounds inclusive
- sort pipeline:
  - single-column sort correctness
  - stable multi-sort behavior

### Component tests

- header clicks update sort indicator + order
- shift-click appends secondary sort
- filters update result count
- virtualization renders only visible rows

### Regression tests

- Overview renders without largest-files section
- Files tab accessible from nav and persists expected defaults

## Acceptance criteria

- [ ] Overview no longer displays "Largest Code Files".
- [ ] Files tab exists and lists repository files.
- [ ] Default view sorted by LOC descending.
- [ ] Filters and column sorting work on all listed metadata.
- [ ] Multi-column sorting works via stable sort chaining.
- [ ] Interaction remains responsive on large repositories.
- [ ] All tests and `npm run validate` pass.

## Risks and mitigations

1. **Large memory footprint with huge repos**
   - Mitigation: compact row shape, avoid repeated clones, memoize once.

2. **Inconsistent generated-file detection across tabs**
   - Mitigation: shared classification utility reused by Overview + Files.

3. **Virtualization edge cases (row heights, keyboard nav)**
   - Mitigation: fixed row height in v1, add keyboard support incrementally.

## Future extensions (post-v1)

- Column chooser / saved layouts
- Persisted filters/sorts per workspace
- Export CSV/JSON of filtered rows
- Worker-based filtering/sorting for extreme repos
- Aggregated folder mode and grouping/pivot views
