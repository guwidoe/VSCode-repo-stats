# Treemap Redesign Specification

**Date:** 2026-01-21
**Status:** Approved
**Goal:** Create a WizTree-inspired treemap with nested hierarchy visualization, vignette shading, and improved interactions.

---

## 1. Core Visual Design

### Rendering Approach
- **Canvas-based rendering** for performance with large repos (50K+ files)
- **D3-hierarchy** for layout calculations using `treemapSquarify` algorithm

### Visual Style

**Tiles:**
- Files: Colored by language (or age), with vignette shading (darker edges, lighter center)
- Directories: Neutral gray with vignette shading
- No padding between siblings - vignette effect provides visual separation

**Vignette Effect:**
- Radial gradient: center at ~90% brightness, edges at ~40% brightness
- Gradient extends from tile center to edges
- Future enhancement: pull gradient center toward parent directory center

**Hierarchy Display:**
- Hybrid approach with configurable nesting depth (default: 3 levels)
- Directories render as containers with children nested inside
- Beyond max nesting depth, double-click navigates into directory

**Directory Labels:**
- Label strip reserved at top of directory IF width >= 80px threshold
- Children render in remaining space below label strip
- If directory too narrow, no label strip - children fill entire space
- Label format: `dirname/ (125.4K)` or `dirname/ (342 files)` based on user toggle

---

## 2. Interactions

### Mouse Interactions

**Hover:**
- Highlight hovered tile with both:
  - Brightness boost (~20% lighter fill)
  - Contrasting border (white or bright accent color, 2px)
- Show tooltip with full details:
  - Full path
  - Size (LOC and file count)
  - Language (for files)
  - Last modified date

**Single Click:**
- Select/highlight the clicked tile
- Selection persists until clicking elsewhere or pressing Escape
- Selected tile gets persistent highlight styling (distinct from hover, e.g., blue border)

**Double Click:**
- File: Open in VSCode editor
- Directory: Navigate into (make it the new root), update breadcrumbs

**Right Click:**
- Context menu:
  - Open File (files only)
  - Reveal in Explorer
  - Copy Path

### Keyboard Support

- **Escape**: Clear selection
- **Enter**: When tile selected, perform double-click action (open/navigate)
- **Backspace**: Navigate up one level (same as clicking parent breadcrumb)

### Breadcrumb Navigation
- Shows current path: `root / src / components / treemap`
- Click any segment to navigate to that level

---

## 3. Layout Algorithm & Label Provisioning

### Hierarchy Layout Process

**Step 1: Calculate base treemap layout**
- Use D3 `treemap()` with `treemapSquarify` tiling
- Set `paddingInner(0)` - no gaps between siblings
- Set `paddingTop(0)` initially - label space handled manually

**Step 2: Determine label visibility per directory**
- For each directory node at visible nesting levels:
  - If `node.x1 - node.x0 >= LABEL_MIN_WIDTH` (80px): reserve label strip
  - Label strip height: 18-20px (single line of text)
  - Otherwise: no label strip, children use full space

**Step 3: Recalculate children bounds**
- Directories WITH label strip: children render in `(x0, y0 + labelHeight, x1, y1)`
- Directories WITHOUT label strip: children render in full area `(x0, y0, x1, y1)`

**Step 4: Recursive layout**
- Apply steps 2-3 recursively up to `maxNestingDepth`
- Beyond max depth, directories render as leaf tiles (clickable to navigate)

### Configuration

```typescript
interface TreemapConfig {
  maxNestingDepth: number;  // Default: 3
  labelMinWidth: number;    // Default: 80px
  labelHeight: number;      // Default: 18px
}
```

---

## 4. Rendering Pipeline

### Canvas Rendering Order

**Pass 1: Directory containers (back to front by depth)**
```
for depth = 0 to maxNestingDepth:
  for each directory at this depth:
    1. Draw filled rectangle (neutral gray base)
    2. Apply vignette gradient overlay
    3. Draw label text if width >= threshold
```

**Pass 2: Leaf tiles (files and deep directories)**
```
for each leaf node:
  1. Get fill color (language or age based)
  2. Draw filled rectangle
  3. Apply vignette gradient overlay
  4. Draw label text if space permits (width >= 60px, height >= 20px)
```

**Pass 3: Interaction overlays**
```
if hoveredNode:
  1. Draw brightness boost layer (semi-transparent white)
  2. Draw highlight border (white/accent, 2px)

if selectedNode:
  1. Draw selection border (blue, 2px)
```

### Vignette Implementation

```typescript
function drawVignette(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  baseColor: string
) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  const radius = Math.max(rx, ry);

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, adjustBrightness(baseColor, 1.1));   // Center: 10% brighter
  gradient.addColorStop(1, adjustBrightness(baseColor, 0.5));   // Edge: 50% darker

  ctx.fillStyle = gradient;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}
```

### High-DPI Support
- Scale canvas by `devicePixelRatio`
- All coordinates in logical pixels

---

## 5. UI Controls & Features

### Top Bar Controls

**Left side: Filter presets**
- All | No Binary | Code Only | Custom
- Custom reveals language picker dropdown

**Right side: Display options**
- Color mode toggle: `By Language` | `By Age`
- Size display toggle: `LOC` | `Files` (NEW)
- Nesting depth control: `Depth: [−] 3 [+]` (NEW)

### Breadcrumb Bar
- Location: Below top controls, above treemap
- Format: `root / src / components / treemap`
- Click segment to navigate up
- Current (deepest) segment is non-clickable, bold

### Legend
- Location: Bottom of treemap panel
- Language mode: Top 8-10 languages + "Other" with color swatches
- Age mode: Gradient bar from green (recent) → red (old) with time labels

### Context Menu
- Right-click any tile:
  - Open File (files only)
  - Reveal in Explorer
  - Copy Path

### Tooltip Content
```
┌─────────────────────────────────┐
│ src/components/TreemapPanel.tsx │  ← Full path
│ TypeScript                      │  ← Language
│ 466 lines · 14.2 KB             │  ← Size metrics
│ Modified: 3 days ago            │  ← Last modified
└─────────────────────────────────┘
```

---

## 6. Performance & Optimization

### Target Performance
- **Repos up to 50K+ files** handled smoothly
- **60fps** for hover, selection, and tooltip interactions
- **Initial render** < 500ms for typical repos (< 10K files)
- Trade memory for speed - caching and pre-computation preferred

### Optimization Strategies

**Layout Caching:**
- Cache D3 layout calculations
- Invalidate on: data change, resize, filter change, nesting depth change
- Hover/selection reuse cached layout

**Render Optimization:**
- Separate static content from interactive overlays
- Consider dirty-rect tracking for partial redraws
- Pre-compute gradient patterns for common tile sizes

**Gradient Optimization:**
- Reuse `CanvasGradient` objects where possible
- Fallback: simplified 4-corner darkening if radial gradients prove slow

**Culling:**
- Skip tiles smaller than 1x1 pixel
- Skip tiles outside viewport (if scrolling implemented)

**Throttling:**
- Debounce resize events (100ms)
- Throttle mousemove for tooltip updates (16ms = 60fps cap)

---

## 7. State Management

### Zustand Store Additions

```typescript
interface TreemapState {
  // Existing
  treemapPath: string[];
  currentTreemapNode: TreemapNode | null;
  treemapFilter: TreemapFilterState;
  colorMode: 'language' | 'age';

  // New
  sizeDisplayMode: 'loc' | 'files';
  maxNestingDepth: number;                     // Default: 3
  hoveredNode: TreemapNode | null;
  selectedNode: TreemapNode | null;

  // New actions
  setSizeDisplayMode(mode: 'loc' | 'files'): void;
  setMaxNestingDepth(depth: number): void;
  setHoveredNode(node: TreemapNode | null): void;
  setSelectedNode(node: TreemapNode | null): void;
  clearSelection(): void;
}
```

### Cache Invalidation Triggers
- `currentTreemapNode` changes (navigation)
- `treemapFilter` changes
- `maxNestingDepth` changes
- `colorMode` changes
- Container dimensions change

---

## 8. Module Structure

```
webview-ui/src/components/treemap/
├── TreemapPanel.tsx              # Main component, orchestrates everything
├── TreemapCanvas.tsx             # Canvas rendering logic
├── TreemapControls.tsx           # Top bar: filters, toggles, depth control
├── TreemapBreadcrumb.tsx         # Breadcrumb navigation
├── TreemapTooltip.tsx            # Hover tooltip
├── TreemapLegend.tsx             # Color legend
├── TreemapContextMenu.tsx        # Right-click menu
├── hooks/
│   ├── useTreemapLayout.ts       # D3 layout calculation + caching
│   ├── useTreemapRender.ts       # Canvas drawing logic
│   └── useTreemapInteractions.ts # Mouse/keyboard handlers
├── utils/
│   ├── vignette.ts               # Gradient drawing utilities
│   ├── colors.ts                 # Color calculations
│   └── layout.ts                 # Layout helpers, label provisioning
└── types.ts                      # Treemap-specific types
```

---

## 9. Implementation Phases

**Phase 1: Modularize**
- Extract current monolithic TreemapPanel into separate components
- Create hooks for layout, rendering, interactions
- No visual changes yet

**Phase 2: Nested Hierarchy**
- Implement directory containers rendering
- Add label provisioning logic
- Remove padding, rely on structure for separation

**Phase 3: Vignette Shading**
- Implement vignette gradient drawing
- Apply to both directories and files
- Tune gradient parameters for visual appeal

**Phase 4: New Interactions**
- Single-click select, double-click navigate/open
- Hover highlight (brightness + border)
- Keyboard support (Escape, Enter, Backspace)

**Phase 5: UI Controls**
- Add size display toggle (LOC / Files)
- Add nesting depth control
- Update tooltip with new format

**Phase 6: Performance**
- Implement layout caching
- Optimize gradient rendering
- Profile and tune for large repos

---

## 10. Future Enhancements (Out of Scope)

- Pull vignette center toward parent directory center (WizTree-style)
- Depth-based directory color shading
- Animated transitions when navigating
- Minimap for large treemaps
- Search/filter highlighting
