# Data Shape Contract

This document records where partial data is expected and where it is considered an error.

## AnalysisResult target contract

`AnalysisResult` is target-aware.

- `target` describes the selected repository set (single repository or any included multi-repository combination)
- `repositories` enumerates the concrete member repositories inside that target
- file paths in `fileTree` are logical target paths and may be prefixed for multi-repository targets
- file nodes may carry `repositoryId` / `repositoryRelativePath` so the UI can map logical rows back to physical repositories

Consumers should not assume a single `repository` field exists.

## TreemapNode contract

`TreemapNode` is intentionally a partial/gradually enriched structure:

- Base tree from LOC analysis:
  - `name`, `path`, `type`
  - `lines` for files
  - `children` for directories
- Metadata enrichment phase may add later:
  - `bytes`, `lastModified`, `binary`
- Blame enrichment phase may add later:
  - `blamedLines`, age metrics, ownership metrics

Because enrichment is staged, consumers may receive nodes where optional metrics are `undefined`.

## Allowed fallbacks (expected partial data)

The following are treated as expected, contract-based defaults:

- `children ?? []` while traversing tree nodes.
- Numeric metric reads such as `node.lines ?? 0`, `node.bytes ?? 0`, etc.
- Map counter reads such as `map.get(k) ?? 0`.

These are not considered error masking; they model absent optional fields as empty/zero for aggregation and rendering.

## Not allowed (error masking)

- Settings-load fallbacks in UI/runtime code that hide missing configuration propagation.
- Silent catch fallbacks for unexpected command/tool failures.
- Hidden runtime defaults that duplicate config schema defaults.

## Explicit exceptions

Some non-nullish fallback behavior is intentional and should remain explicit:

- Treemap layout minimum sizing in `sizeMode='complexity'` uses `|| 1` to avoid zero-area rendering.
- ISO week calculations use `getDay() || 7` to map Sunday (`0`) to ISO weekday `7`.

When adding more exceptions, document rationale here.
