# Blame Metrics in Standard Analysis: Overview + Files Implementation Plan

Date: 2026-03-05  
Status: Planned  
Owner: Repo Stats extension/webview

## Goal

Add a **single HEAD-only git blame pass** to standard analysis and use it to power:

1. **Overview chart:** LOC by Contributor (current line ownership)
2. **Overview chart:** LOC by Line Age (bucketed from line-last-modified, not file-last-modified)
3. **Files tab metadata columns/filters/sorts** derived from blame results

Key requirement: store line-age data in a way that supports **instant arbitrary bucket queries** in UI without re-running analysis.

---

## Confirmed product decisions

- Use **standard analysis** (core run), not evolution, for current-state blame metrics.
- Keep age bucketing **flexible** (no rigid backend-only bucket definition).
- Reuse same blame pass for both overview graphics and file metadata enrichment.

---

## Data model changes

## 1) Core types (`src/types/index.ts` + `webview-ui/src/types.ts`)

Add to `AnalysisResult`:

```ts
interface BlameOwnershipEntry {
  author: string;
  email: string;
  lines: number;
}

interface BlameMetrics {
  analyzedAt: string;              // ISO
  maxAgeDays: number;              // highest age index seen
  ageByDay: number[];              // ageByDay[days] = line count
  ownershipByAuthor: BlameOwnershipEntry[]; // sorted desc by lines
  totals: {
    totalBlamedLines: number;
    filesAnalyzed: number;
    filesSkipped: number;
  };
}
```

Add optional per-file blame summary fields on `TreemapNode` (file nodes):

```ts
blamedLines?: number;
lineAgeAvgDays?: number;
lineAgeMinDays?: number;
lineAgeMaxDays?: number;
topOwnerAuthor?: string;
topOwnerEmail?: string;
topOwnerLines?: number;
topOwnerShare?: number; // 0..1
```

Rationale: keeps age buckets queryable at any granularity and surfaces actionable per-file ownership/age stats.

---

## 2) Cache changes (`src/cache/cacheManager.ts`)

- Bump cache version (e.g. `1.2.0`).
- Persist `blameMetrics` in cache payload.
- Ensure `getIfValid()` restores `blameMetrics` into returned `AnalysisResult`.

Optional optimization (phase 2, but design now):

- Add file-level blame cache keyed by blob SHA for incremental reuse.

---

## Analyzer architecture changes

## 1) Git client extensions (`src/analyzers/gitAnalyzer.ts`)

Extend `GitClient` with:

- `getHeadBlobShas(paths: string[]): Promise<Map<string, string>>` (optional but recommended)
- `getLineBlamePorcelainAtHead(path: string): Promise<string>` (or generic raw wrapper)

Could also expose a low-level `raw(args: string[]): Promise<string>` if preferred for flexibility.

## 2) New blame metrics pass in coordinator (`src/analyzers/coordinator.ts`)

Add a new phase after file tree + metadata enrichment:

- collect candidate files:
  - file nodes only
  - non-binary
  - lines > 0
- run concurrent HEAD blame parsing
- aggregate:
  - global `ageByDay`
  - global ownership map (`author/email -> lines`)
  - per-file summary metrics
- attach file summaries onto corresponding tree nodes
- place global result in `AnalysisResult.blameMetrics`

Progress phases (example):

- `Computing line ownership and age (blame)`
- `% progress` by processed file count

---

## Blame parsing algorithm

For each file (`git blame HEAD --line-porcelain -- <path>`):

- parse hunk headers + metadata (`author`, `author-mail`, `author-time`, `num lines`)
- compute `ageDays = floor((now - authorTime) / 86400)`
- increment `ageByDay[ageDays] += hunkLineCount`
- increment ownership counter for `(author,email)`
- maintain per-file stats:
  - `blamedLines`
  - min/max/avg age
  - top owner + share

Store unknown author/email fallback safely (`Unknown`, `unknown@unknown.local`).

---

## Performance strategy

1. **Concurrency-limited worker pool** (start with 6–8 workers)
2. Skip files that are:
   - binary
   - 0 LOC
   - excluded by existing settings
3. Optional safeguards:
   - max file size/LOC threshold for blame
   - timeout per blame command (best effort)
4. Future-proof with blob-SHA cache:
   - unchanged files skip re-blame on next run

Note: even without blob-SHA reuse, one HEAD-only pass is expected to be substantially cheaper than evolution’s multi-snapshot analysis.

---

## Webview implementation changes

## 1) Overview panel

Add two charts/cards:

1. **LOC by Contributor (Current Ownership)**
   - segments from `blameMetrics.ownershipByAuthor`
   - top N + "Other"

2. **LOC by Line Age (Blame)**
   - build buckets from `ageByDay`
   - support presets and custom edges in UI (without backend rerun)

Bucket computation strategy:

- precompute prefix sums in hook:
  - `prefix[i] = sum(ageByDay[0..i])`
- arbitrary bucket `[a,b]` -> `prefix[b] - prefix[a-1]`

This gives instant recomputation when user changes bucket boundaries.

## 2) Files tab enhancements

Add columns (sortable/filterable):

- Blamed LOC
- Avg Age (days)
- Youngest line age (days)
- Oldest line age (days)
- Top Owner
- Top Owner Share

Add filters:

- numeric ranges for age stats + blamed LOC
- text filter for top owner (author/email)

---

## Settings and UX

Add optional setting:

- `repoStats.enableBlameMetrics` (boolean, default: true/false to be decided)

Behavior:

- if disabled: skip blame phase entirely
- Overview charts show explanatory empty-state/CTA
- Files tab hides blame columns or shows `—`

Potential additional knobs (optional):

- `repoStats.blameMaxWorkers`
- `repoStats.blameMaxFileLines`

---

## Testing plan

## 1) Unit tests (core)

- blame porcelain parser correctness
- age histogram accumulation
- ownership aggregation
- per-file summary metrics
- edge cases: unknown author/email, invalid timestamps, empty/blame-fail files

## 2) Coordinator tests

- includes `blameMetrics` in final `AnalysisResult`
- updates progress through blame phase
- gracefully degrades when some files fail blame

## 3) Cache tests

- cache round-trip for new blame fields
- cache invalidation on version bump

## 4) Webview tests

- Overview contributor chart renders from `blameMetrics`
- Overview age chart bucket recomputation for custom edges
- Files tab sort/filter on blame columns works

---

## Rollout plan

1. Add types + cache schema changes
2. Implement blame parser + coordinator integration
3. Add overview hooks/components for both charts
4. Extend files tab rows/filters/sorts/columns
5. Add tests
6. Run full gate: `npm run validate`

---

## Acceptance criteria

- [ ] Standard analysis returns `blameMetrics` for current HEAD.
- [ ] Overview shows LOC by Contributor (current ownership).
- [ ] Overview shows LOC by Line Age from line-level blame data.
- [ ] Age chart supports arbitrary bucket boundaries instantly (no re-analysis).
- [ ] Files tab includes sortable/filterable blame-derived columns.
- [ ] Performance acceptable on medium/large repos with bounded concurrency.
- [ ] Graceful fallback when blame is disabled or partially fails.
- [ ] `npm run validate` passes.

---

## Risks and mitigations

1. **Large repo latency increase**
   - Mitigate with worker cap + optional skip thresholds + future blob-SHA reuse.

2. **Memory growth from dense age arrays**
   - `ageByDay` is compact; trim trailing zeros and store `maxAgeDays`.

3. **Blame inaccuracies on renamed/moved files**
   - Default to standard blame behavior first; optionally add rename-follow tuning later.

4. **UI clutter on Overview**
   - Keep chart sections compact, collapsible details for long legends.
