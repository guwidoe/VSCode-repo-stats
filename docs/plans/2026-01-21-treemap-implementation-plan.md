# Treemap Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the monolithic treemap into a WizTree-inspired visualization with nested hierarchy, vignette shading, and improved interactions.

**Architecture:** Canvas-based rendering with D3-hierarchy for layout calculations. Modular component structure with custom hooks for layout, rendering, and interactions. Zustand for state management with layout caching.

**Tech Stack:** React 18, TypeScript, D3-hierarchy, Canvas 2D API, Zustand, Vitest

**Spec Reference:** [2026-01-21-treemap-redesign-spec.md](./2026-01-21-treemap-redesign-spec.md)

---

## Phase 1: Modularize Current Components

Extract the monolithic TreemapPanel.tsx (466 lines) into focused modules without changing visual behavior.

### Task 1.1: Create Treemap Types Module

**Files:**
- Create: `webview-ui/src/components/treemap/types.ts`

**Step 1: Create the types file**

```typescript
// webview-ui/src/components/treemap/types.ts
import type { TreemapNode } from '../../types'

export interface TreemapConfig {
  maxNestingDepth: number      // Default: 3
  labelMinWidth: number        // Default: 80px
  labelHeight: number          // Default: 18px
}

export const DEFAULT_TREEMAP_CONFIG: TreemapConfig = {
  maxNestingDepth: 3,
  labelMinWidth: 80,
  labelHeight: 18,
}

export type SizeDisplayMode = 'loc' | 'files'

export interface LayoutNode {
  data: TreemapNode
  x0: number
  y0: number
  x1: number
  y1: number
  depth: number
  children?: LayoutNode[]
  parent?: LayoutNode
  hasLabelStrip: boolean
  isLeaf: boolean
}

export interface TooltipState {
  visible: boolean
  x: number
  y: number
  node: TreemapNode | null
}

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  node: TreemapNode | null
}

export interface TreemapDimensions {
  width: number
  height: number
  devicePixelRatio: number
}
```

**Step 2: Commit**

```bash
git add webview-ui/src/components/treemap/types.ts
git commit -m "feat(treemap): add types module for treemap redesign"
```

---

### Task 1.2: Extract Color Utilities

**Files:**
- Create: `webview-ui/src/components/treemap/utils/colors.ts`
- Create: `webview-ui/src/components/treemap/utils/colors.test.ts`

**Step 1: Write failing tests**

```typescript
// webview-ui/src/components/treemap/utils/colors.test.ts
import { describe, it, expect } from 'vitest'
import { adjustBrightness, getContrastColor, parseColor, colorToRgba } from './colors'

describe('adjustBrightness', () => {
  it('should brighten a color with factor > 1', () => {
    const result = adjustBrightness('#808080', 1.5)
    // Gray 128 * 1.5 = 192
    expect(result).toBe('rgb(192, 192, 192)')
  })

  it('should darken a color with factor < 1', () => {
    const result = adjustBrightness('#ffffff', 0.5)
    expect(result).toBe('rgb(128, 128, 128)')
  })

  it('should clamp values to 0-255', () => {
    const result = adjustBrightness('#ffffff', 2)
    expect(result).toBe('rgb(255, 255, 255)')
  })
})

describe('getContrastColor', () => {
  it('should return white for dark backgrounds', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff')
    expect(getContrastColor('#333333')).toBe('#ffffff')
  })

  it('should return dark color for light backgrounds', () => {
    expect(getContrastColor('#ffffff')).toBe('#1e1e1e')
    expect(getContrastColor('#f0f0f0')).toBe('#1e1e1e')
  })
})

describe('parseColor', () => {
  it('should parse hex colors', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseColor('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('should parse short hex colors', () => {
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('should parse rgb colors', () => {
    expect(parseColor('rgb(255, 128, 64)')).toEqual({ r: 255, g: 128, b: 64 })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/components/treemap/utils/colors.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement the colors module**

```typescript
// webview-ui/src/components/treemap/utils/colors.ts

export interface RGB {
  r: number
  g: number
  b: number
}

/**
 * Parse a color string to RGB values
 */
export function parseColor(color: string): RGB {
  // Handle hex colors
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }

  // Handle rgb() colors
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    }
  }

  // Default fallback
  return { r: 128, g: 128, b: 128 }
}

/**
 * Convert RGB to CSS color string
 */
export function colorToRgba(rgb: RGB, alpha = 1): string {
  if (alpha === 1) {
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/**
 * Adjust brightness of a color by a factor
 * factor > 1 brightens, factor < 1 darkens
 */
export function adjustBrightness(color: string, factor: number): string {
  const rgb = parseColor(color)
  return colorToRgba({
    r: Math.min(255, Math.max(0, Math.round(rgb.r * factor))),
    g: Math.min(255, Math.max(0, Math.round(rgb.g * factor))),
    b: Math.min(255, Math.max(0, Math.round(rgb.b * factor))),
  })
}

/**
 * Get a contrasting text color (white or dark) for a background
 */
export function getContrastColor(backgroundColor: string): string {
  const rgb = parseColor(backgroundColor)
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? '#1e1e1e' : '#ffffff'
}

/**
 * Standard directory color (neutral gray)
 */
export const DIRECTORY_COLOR = '#4a4a4a'

/**
 * Hover highlight color (semi-transparent white overlay)
 */
export const HOVER_OVERLAY_COLOR = 'rgba(255, 255, 255, 0.2)'

/**
 * Selection border color
 */
export const SELECTION_BORDER_COLOR = '#007acc'

/**
 * Hover border color
 */
export const HOVER_BORDER_COLOR = '#ffffff'
```

**Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/components/treemap/utils/colors.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add webview-ui/src/components/treemap/utils/
git commit -m "feat(treemap): add color utilities with brightness adjustment"
```

---

### Task 1.3: Extract Vignette Rendering Utility

**Files:**
- Create: `webview-ui/src/components/treemap/utils/vignette.ts`
- Create: `webview-ui/src/components/treemap/utils/vignette.test.ts`

**Step 1: Write failing tests**

```typescript
// webview-ui/src/components/treemap/utils/vignette.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createVignetteGradient, drawVignetteTile } from './vignette'

describe('createVignetteGradient', () => {
  it('should create a radial gradient with correct parameters', () => {
    const mockGradient = {
      addColorStop: vi.fn(),
    }
    const mockCtx = {
      createRadialGradient: vi.fn(() => mockGradient),
    } as unknown as CanvasRenderingContext2D

    const gradient = createVignetteGradient(mockCtx, 0, 0, 100, 80, '#ff0000')

    // Center should be at (50, 40), radius should be max(50, 40) = 50
    expect(mockCtx.createRadialGradient).toHaveBeenCalledWith(50, 40, 0, 50, 40, 50)
    expect(mockGradient.addColorStop).toHaveBeenCalledTimes(2)
  })
})

describe('drawVignetteTile', () => {
  it('should draw a filled rectangle with vignette gradient', () => {
    const mockGradient = { addColorStop: vi.fn() }
    const mockCtx = {
      createRadialGradient: vi.fn(() => mockGradient),
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D

    drawVignetteTile(mockCtx, 10, 20, 110, 100, '#00ff00')

    expect(mockCtx.fillRect).toHaveBeenCalledWith(10, 20, 100, 80)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/components/treemap/utils/vignette.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement the vignette module**

```typescript
// webview-ui/src/components/treemap/utils/vignette.ts
import { adjustBrightness } from './colors'

/**
 * Create a radial gradient for vignette effect
 * Center is brighter, edges are darker
 */
export function createVignetteGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  baseColor: string
): CanvasGradient {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2
  const ry = (y1 - y0) / 2
  const radius = Math.max(rx, ry)

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  gradient.addColorStop(0, adjustBrightness(baseColor, 1.1))   // Center: 10% brighter
  gradient.addColorStop(1, adjustBrightness(baseColor, 0.5))   // Edge: 50% darker

  return gradient
}

/**
 * Draw a tile with vignette shading effect
 */
export function drawVignetteTile(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  baseColor: string
): void {
  const width = x1 - x0
  const height = y1 - y0

  if (width < 1 || height < 1) return

  const gradient = createVignetteGradient(ctx, x0, y0, x1, y1, baseColor)
  ctx.fillStyle = gradient
  ctx.fillRect(x0, y0, width, height)
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/components/treemap/utils/vignette.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add webview-ui/src/components/treemap/utils/vignette.ts webview-ui/src/components/treemap/utils/vignette.test.ts
git commit -m "feat(treemap): add vignette gradient rendering utility"
```

---

### Task 1.4: Create Utils Index

**Files:**
- Create: `webview-ui/src/components/treemap/utils/index.ts`

**Step 1: Create the index file**

```typescript
// webview-ui/src/components/treemap/utils/index.ts
export * from './colors'
export * from './vignette'
```

**Step 2: Commit**

```bash
git add webview-ui/src/components/treemap/utils/index.ts
git commit -m "feat(treemap): add utils index for clean imports"
```

---

### Task 1.5: Extract Breadcrumb Component

**Files:**
- Create: `webview-ui/src/components/treemap/TreemapBreadcrumb.tsx`
- Create: `webview-ui/src/components/treemap/TreemapBreadcrumb.css`
- Create: `webview-ui/src/components/treemap/TreemapBreadcrumb.test.tsx`

**Step 1: Write failing tests**

```typescript
// webview-ui/src/components/treemap/TreemapBreadcrumb.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TreemapBreadcrumb } from './TreemapBreadcrumb'

describe('TreemapBreadcrumb', () => {
  it('should render root when path is empty', () => {
    render(<TreemapBreadcrumb path={[]} onNavigate={vi.fn()} />)
    expect(screen.getByText('root')).toBeInTheDocument()
  })

  it('should render path segments', () => {
    render(<TreemapBreadcrumb path={['src', 'components']} onNavigate={vi.fn()} />)
    expect(screen.getByText('root')).toBeInTheDocument()
    expect(screen.getByText('src')).toBeInTheDocument()
    expect(screen.getByText('components')).toBeInTheDocument()
  })

  it('should call onNavigate with correct path when clicking segment', () => {
    const onNavigate = vi.fn()
    render(<TreemapBreadcrumb path={['src', 'components', 'treemap']} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByText('src'))
    expect(onNavigate).toHaveBeenCalledWith(['src'])
  })

  it('should not make the last segment clickable', () => {
    const onNavigate = vi.fn()
    render(<TreemapBreadcrumb path={['src', 'components']} onNavigate={onNavigate} />)

    const lastSegment = screen.getByText('components')
    fireEvent.click(lastSegment)
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapBreadcrumb.test.tsx
```

Expected: FAIL - module not found

**Step 3: Implement the Breadcrumb component**

```typescript
// webview-ui/src/components/treemap/TreemapBreadcrumb.tsx
import './TreemapBreadcrumb.css'

interface TreemapBreadcrumbProps {
  path: string[]
  onNavigate: (path: string[]) => void
}

export function TreemapBreadcrumb({ path, onNavigate }: TreemapBreadcrumbProps) {
  const handleClick = (index: number) => {
    if (index === path.length - 1) return // Last segment not clickable
    onNavigate(path.slice(0, index + 1))
  }

  const handleRootClick = () => {
    onNavigate([])
  }

  return (
    <div className="treemap-breadcrumb">
      <span
        className={`breadcrumb-segment ${path.length === 0 ? 'current' : 'clickable'}`}
        onClick={path.length > 0 ? handleRootClick : undefined}
      >
        root
      </span>
      {path.map((segment, index) => (
        <span key={index}>
          <span className="breadcrumb-separator">/</span>
          <span
            className={`breadcrumb-segment ${index === path.length - 1 ? 'current' : 'clickable'}`}
            onClick={index < path.length - 1 ? () => handleClick(index) : undefined}
          >
            {segment}
          </span>
        </span>
      ))}
    </div>
  )
}
```

**Step 4: Create CSS file**

```css
/* webview-ui/src/components/treemap/TreemapBreadcrumb.css */
.treemap-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  font-size: 13px;
  font-family: var(--vscode-font-family);
  overflow-x: auto;
  white-space: nowrap;
}

.breadcrumb-segment {
  padding: 2px 6px;
  border-radius: 3px;
}

.breadcrumb-segment.clickable {
  cursor: pointer;
  color: var(--vscode-textLink-foreground);
}

.breadcrumb-segment.clickable:hover {
  background: var(--vscode-list-hoverBackground);
}

.breadcrumb-segment.current {
  font-weight: 600;
  color: var(--vscode-foreground);
}

.breadcrumb-separator {
  color: var(--vscode-descriptionForeground);
  margin: 0 2px;
}
```

**Step 5: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapBreadcrumb.test.tsx
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add webview-ui/src/components/treemap/TreemapBreadcrumb.*
git commit -m "feat(treemap): extract Breadcrumb into separate component"
```

---

### Task 1.6: Extract Tooltip Component

**Files:**
- Create: `webview-ui/src/components/treemap/TreemapTooltip.tsx`
- Create: `webview-ui/src/components/treemap/TreemapTooltip.css`
- Create: `webview-ui/src/components/treemap/TreemapTooltip.test.tsx`

**Step 1: Write failing tests**

```typescript
// webview-ui/src/components/treemap/TreemapTooltip.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TreemapTooltip } from './TreemapTooltip'
import type { TreemapNode } from '../../types'

const mockFileNode: TreemapNode = {
  name: 'index.ts',
  path: 'src/components/index.ts',
  type: 'file',
  lines: 150,
  language: 'TypeScript',
  lastModified: '2026-01-15T10:00:00Z',
}

const mockDirNode: TreemapNode = {
  name: 'components',
  path: 'src/components',
  type: 'directory',
  lines: 5000,
  children: [],
}

describe('TreemapTooltip', () => {
  it('should not render when not visible', () => {
    const { container } = render(
      <TreemapTooltip visible={false} x={0} y={0} node={mockFileNode} sizeMode="loc" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render file info when visible', () => {
    render(<TreemapTooltip visible={true} x={100} y={100} node={mockFileNode} sizeMode="loc" />)
    expect(screen.getByText('src/components/index.ts')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText(/150 lines/)).toBeInTheDocument()
  })

  it('should render directory info', () => {
    render(<TreemapTooltip visible={true} x={100} y={100} node={mockDirNode} sizeMode="loc" />)
    expect(screen.getByText('src/components')).toBeInTheDocument()
    expect(screen.getByText(/5.0K lines/)).toBeInTheDocument()
  })

  it('should show file count when sizeMode is files', () => {
    const dirWithChildren: TreemapNode = {
      ...mockDirNode,
      children: [mockFileNode, mockFileNode, mockFileNode],
    }
    render(<TreemapTooltip visible={true} x={100} y={100} node={dirWithChildren} sizeMode="files" />)
    expect(screen.getByText(/3 files/)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapTooltip.test.tsx
```

Expected: FAIL - module not found

**Step 3: Implement the Tooltip component**

```typescript
// webview-ui/src/components/treemap/TreemapTooltip.tsx
import type { TreemapNode } from '../../types'
import type { SizeDisplayMode } from './types'
import { formatNumber, formatRelativeTime } from '../../utils/colors'
import './TreemapTooltip.css'

interface TreemapTooltipProps {
  visible: boolean
  x: number
  y: number
  node: TreemapNode | null
  sizeMode: SizeDisplayMode
}

function countFiles(node: TreemapNode): number {
  if (node.type === 'file') return 1
  return (node.children || []).reduce((sum, child) => sum + countFiles(child), 0)
}

export function TreemapTooltip({ visible, x, y, node, sizeMode }: TreemapTooltipProps) {
  if (!visible || !node) return null

  const isFile = node.type === 'file'
  const lines = node.lines || 0
  const fileCount = countFiles(node)

  return (
    <div
      className="treemap-tooltip"
      style={{
        left: x + 15,
        top: y + 15,
      }}
    >
      <div className="tooltip-path">{node.path}</div>
      {isFile && node.language && (
        <div className="tooltip-language">{node.language}</div>
      )}
      <div className="tooltip-size">
        {sizeMode === 'loc' ? (
          <>{formatNumber(lines)} lines</>
        ) : (
          <>{formatNumber(fileCount)} files</>
        )}
        {isFile && <> &middot; {formatNumber(Math.round(lines * 40))} bytes</>}
      </div>
      {node.lastModified && (
        <div className="tooltip-modified">
          Modified: {formatRelativeTime(node.lastModified)}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Create CSS file**

```css
/* webview-ui/src/components/treemap/TreemapTooltip.css */
.treemap-tooltip {
  position: fixed;
  z-index: 1000;
  padding: 8px 12px;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  font-size: 12px;
  font-family: var(--vscode-font-family);
  max-width: 400px;
  pointer-events: none;
}

.tooltip-path {
  font-weight: 600;
  color: var(--vscode-foreground);
  word-break: break-all;
  margin-bottom: 4px;
}

.tooltip-language {
  color: var(--vscode-textLink-foreground);
  margin-bottom: 4px;
}

.tooltip-size {
  color: var(--vscode-descriptionForeground);
}

.tooltip-modified {
  color: var(--vscode-descriptionForeground);
  margin-top: 4px;
  font-size: 11px;
}
```

**Step 5: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapTooltip.test.tsx
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add webview-ui/src/components/treemap/TreemapTooltip.*
git commit -m "feat(treemap): extract Tooltip into separate component"
```

---

### Task 1.7: Extract Context Menu Component

**Files:**
- Create: `webview-ui/src/components/treemap/TreemapContextMenu.tsx`
- Create: `webview-ui/src/components/treemap/TreemapContextMenu.css`
- Create: `webview-ui/src/components/treemap/TreemapContextMenu.test.tsx`

**Step 1: Write failing tests**

```typescript
// webview-ui/src/components/treemap/TreemapContextMenu.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TreemapContextMenu } from './TreemapContextMenu'
import type { TreemapNode } from '../../types'

const mockFileNode: TreemapNode = {
  name: 'index.ts',
  path: 'src/components/index.ts',
  type: 'file',
  lines: 150,
}

const mockDirNode: TreemapNode = {
  name: 'components',
  path: 'src/components',
  type: 'directory',
  lines: 5000,
}

describe('TreemapContextMenu', () => {
  it('should not render when not visible', () => {
    const { container } = render(
      <TreemapContextMenu
        visible={false}
        x={0}
        y={0}
        node={mockFileNode}
        onOpenFile={vi.fn()}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should show Open File option for files', () => {
    render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={mockFileNode}
        onOpenFile={vi.fn()}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Open File')).toBeInTheDocument()
  })

  it('should not show Open File option for directories', () => {
    render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={mockDirNode}
        onOpenFile={vi.fn()}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByText('Open File')).not.toBeInTheDocument()
  })

  it('should call onOpenFile when clicking Open File', () => {
    const onOpenFile = vi.fn()
    render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={mockFileNode}
        onOpenFile={onOpenFile}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Open File'))
    expect(onOpenFile).toHaveBeenCalledWith(mockFileNode.path)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapContextMenu.test.tsx
```

Expected: FAIL - module not found

**Step 3: Implement the ContextMenu component**

```typescript
// webview-ui/src/components/treemap/TreemapContextMenu.tsx
import { useEffect, useRef } from 'react'
import type { TreemapNode } from '../../types'
import './TreemapContextMenu.css'

interface TreemapContextMenuProps {
  visible: boolean
  x: number
  y: number
  node: TreemapNode | null
  onOpenFile: (path: string) => void
  onRevealInExplorer: (path: string) => void
  onCopyPath: (path: string) => void
  onClose: () => void
}

export function TreemapContextMenu({
  visible,
  x,
  y,
  node,
  onOpenFile,
  onRevealInExplorer,
  onCopyPath,
  onClose,
}: TreemapContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible || !node) return null

  const isFile = node.type === 'file'

  return (
    <div
      ref={menuRef}
      className="treemap-context-menu"
      style={{ left: x, top: y }}
    >
      {isFile && (
        <button
          className="context-menu-item"
          onClick={() => {
            onOpenFile(node.path)
            onClose()
          }}
        >
          Open File
        </button>
      )}
      <button
        className="context-menu-item"
        onClick={() => {
          onRevealInExplorer(node.path)
          onClose()
        }}
      >
        Reveal in Explorer
      </button>
      <button
        className="context-menu-item"
        onClick={() => {
          onCopyPath(node.path)
          onClose()
        }}
      >
        Copy Path
      </button>
    </div>
  )
}
```

**Step 4: Create CSS file**

```css
/* webview-ui/src/components/treemap/TreemapContextMenu.css */
.treemap-context-menu {
  position: fixed;
  z-index: 1001;
  background: var(--vscode-menu-background);
  border: 1px solid var(--vscode-menu-border);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  min-width: 160px;
  padding: 4px 0;
}

.context-menu-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  text-align: left;
  background: none;
  border: none;
  color: var(--vscode-menu-foreground);
  font-size: 13px;
  font-family: var(--vscode-font-family);
  cursor: pointer;
}

.context-menu-item:hover {
  background: var(--vscode-menu-selectionBackground);
  color: var(--vscode-menu-selectionForeground);
}
```

**Step 5: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapContextMenu.test.tsx
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add webview-ui/src/components/treemap/TreemapContextMenu.*
git commit -m "feat(treemap): extract ContextMenu into separate component"
```

---

### Task 1.8: Extract Legend Component

**Files:**
- Create: `webview-ui/src/components/treemap/TreemapLegend.tsx`
- Create: `webview-ui/src/components/treemap/TreemapLegend.css`
- Create: `webview-ui/src/components/treemap/TreemapLegend.test.tsx`

**Step 1: Write failing tests**

```typescript
// webview-ui/src/components/treemap/TreemapLegend.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TreemapLegend } from './TreemapLegend'

const mockLanguageCounts = new Map([
  ['TypeScript', 5000],
  ['JavaScript', 3000],
  ['CSS', 1000],
])

describe('TreemapLegend', () => {
  it('should render language legend in language mode', () => {
    render(
      <TreemapLegend
        colorMode="language"
        languageCounts={mockLanguageCounts}
      />
    )
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
  })

  it('should render age legend in age mode', () => {
    render(
      <TreemapLegend
        colorMode="age"
        languageCounts={mockLanguageCounts}
      />
    )
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('Old')).toBeInTheDocument()
  })

  it('should limit displayed languages to top 8', () => {
    const manyLanguages = new Map([
      ['Lang1', 1000], ['Lang2', 900], ['Lang3', 800], ['Lang4', 700],
      ['Lang5', 600], ['Lang6', 500], ['Lang7', 400], ['Lang8', 300],
      ['Lang9', 200], ['Lang10', 100],
    ])
    render(
      <TreemapLegend
        colorMode="language"
        languageCounts={manyLanguages}
      />
    )
    expect(screen.getByText('Lang1')).toBeInTheDocument()
    expect(screen.getByText('Lang8')).toBeInTheDocument()
    expect(screen.queryByText('Lang9')).not.toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapLegend.test.tsx
```

Expected: FAIL - module not found

**Step 3: Implement the Legend component**

```typescript
// webview-ui/src/components/treemap/TreemapLegend.tsx
import type { ColorMode } from '../../types'
import { getLanguageColor } from '../../utils/colors'
import { formatNumber } from '../../utils/colors'
import './TreemapLegend.css'

interface TreemapLegendProps {
  colorMode: ColorMode
  languageCounts: Map<string, number>
}

const MAX_LEGEND_ITEMS = 8

export function TreemapLegend({ colorMode, languageCounts }: TreemapLegendProps) {
  if (colorMode === 'age') {
    return (
      <div className="treemap-legend age-legend">
        <span className="age-label">Recent</span>
        <div className="age-gradient" />
        <span className="age-label">Old</span>
      </div>
    )
  }

  // Language mode
  const sortedLanguages = Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LEGEND_ITEMS)

  return (
    <div className="treemap-legend language-legend">
      {sortedLanguages.map(([language, count]) => (
        <div key={language} className="legend-item">
          <span
            className="legend-color"
            style={{ backgroundColor: getLanguageColor(language) }}
          />
          <span className="legend-label">{language}</span>
          <span className="legend-count">{formatNumber(count)}</span>
        </div>
      ))}
    </div>
  )
}
```

**Step 4: Create CSS file**

```css
/* webview-ui/src/components/treemap/TreemapLegend.css */
.treemap-legend {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--vscode-editor-background);
  border-top: 1px solid var(--vscode-panel-border);
  font-size: 12px;
  overflow-x: auto;
}

.language-legend {
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-label {
  color: var(--vscode-foreground);
  white-space: nowrap;
}

.legend-count {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}

.age-legend {
  gap: 8px;
}

.age-gradient {
  width: 120px;
  height: 12px;
  border-radius: 2px;
  background: linear-gradient(to right, #22c55e, #eab308, #ef4444);
}

.age-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}
```

**Step 5: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapLegend.test.tsx
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add webview-ui/src/components/treemap/TreemapLegend.*
git commit -m "feat(treemap): extract Legend into separate component"
```

---

### Task 1.9: Extract Controls Component

**Files:**
- Create: `webview-ui/src/components/treemap/TreemapControls.tsx`
- Create: `webview-ui/src/components/treemap/TreemapControls.css`
- Create: `webview-ui/src/components/treemap/TreemapControls.test.tsx`

**Step 1: Write failing tests**

```typescript
// webview-ui/src/components/treemap/TreemapControls.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TreemapControls } from './TreemapControls'

describe('TreemapControls', () => {
  const defaultProps = {
    colorMode: 'language' as const,
    sizeMode: 'loc' as const,
    nestingDepth: 3,
    onColorModeChange: vi.fn(),
    onSizeModeChange: vi.fn(),
    onNestingDepthChange: vi.fn(),
  }

  it('should render color mode toggle', () => {
    render(<TreemapControls {...defaultProps} />)
    expect(screen.getByText('By Language')).toBeInTheDocument()
    expect(screen.getByText('By Age')).toBeInTheDocument()
  })

  it('should render size mode toggle', () => {
    render(<TreemapControls {...defaultProps} />)
    expect(screen.getByText('LOC')).toBeInTheDocument()
    expect(screen.getByText('Files')).toBeInTheDocument()
  })

  it('should render nesting depth control', () => {
    render(<TreemapControls {...defaultProps} />)
    expect(screen.getByText('Depth:')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('should call onColorModeChange when toggling', () => {
    const onColorModeChange = vi.fn()
    render(<TreemapControls {...defaultProps} onColorModeChange={onColorModeChange} />)
    fireEvent.click(screen.getByText('By Age'))
    expect(onColorModeChange).toHaveBeenCalledWith('age')
  })

  it('should call onNestingDepthChange when clicking plus', () => {
    const onNestingDepthChange = vi.fn()
    render(<TreemapControls {...defaultProps} onNestingDepthChange={onNestingDepthChange} />)
    fireEvent.click(screen.getByText('+'))
    expect(onNestingDepthChange).toHaveBeenCalledWith(4)
  })

  it('should not allow depth below 1', () => {
    const onNestingDepthChange = vi.fn()
    render(<TreemapControls {...defaultProps} nestingDepth={1} onNestingDepthChange={onNestingDepthChange} />)
    fireEvent.click(screen.getByText('−'))
    expect(onNestingDepthChange).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapControls.test.tsx
```

Expected: FAIL - module not found

**Step 3: Implement the Controls component**

```typescript
// webview-ui/src/components/treemap/TreemapControls.tsx
import type { ColorMode } from '../../types'
import type { SizeDisplayMode } from './types'
import './TreemapControls.css'

interface TreemapControlsProps {
  colorMode: ColorMode
  sizeMode: SizeDisplayMode
  nestingDepth: number
  onColorModeChange: (mode: ColorMode) => void
  onSizeModeChange: (mode: SizeDisplayMode) => void
  onNestingDepthChange: (depth: number) => void
}

const MAX_NESTING_DEPTH = 10
const MIN_NESTING_DEPTH = 1

export function TreemapControls({
  colorMode,
  sizeMode,
  nestingDepth,
  onColorModeChange,
  onSizeModeChange,
  onNestingDepthChange,
}: TreemapControlsProps) {
  const handleDepthDecrease = () => {
    if (nestingDepth > MIN_NESTING_DEPTH) {
      onNestingDepthChange(nestingDepth - 1)
    }
  }

  const handleDepthIncrease = () => {
    if (nestingDepth < MAX_NESTING_DEPTH) {
      onNestingDepthChange(nestingDepth + 1)
    }
  }

  return (
    <div className="treemap-controls">
      <div className="controls-right">
        {/* Color mode toggle */}
        <div className="toggle-group">
          <button
            className={`toggle-button ${colorMode === 'language' ? 'active' : ''}`}
            onClick={() => onColorModeChange('language')}
          >
            By Language
          </button>
          <button
            className={`toggle-button ${colorMode === 'age' ? 'active' : ''}`}
            onClick={() => onColorModeChange('age')}
          >
            By Age
          </button>
        </div>

        {/* Size mode toggle */}
        <div className="toggle-group">
          <button
            className={`toggle-button ${sizeMode === 'loc' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('loc')}
          >
            LOC
          </button>
          <button
            className={`toggle-button ${sizeMode === 'files' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('files')}
          >
            Files
          </button>
        </div>

        {/* Nesting depth control */}
        <div className="depth-control">
          <span className="depth-label">Depth:</span>
          <button
            className="depth-button"
            onClick={handleDepthDecrease}
            disabled={nestingDepth <= MIN_NESTING_DEPTH}
          >
            −
          </button>
          <span className="depth-value">{nestingDepth}</span>
          <button
            className="depth-button"
            onClick={handleDepthIncrease}
            disabled={nestingDepth >= MAX_NESTING_DEPTH}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Create CSS file**

```css
/* webview-ui/src/components/treemap/TreemapControls.css */
.treemap-controls {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 12px;
  background: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  gap: 16px;
}

.controls-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toggle-group {
  display: flex;
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 4px;
  overflow: hidden;
}

.toggle-button {
  padding: 4px 10px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  font-size: 12px;
  font-family: var(--vscode-font-family);
  cursor: pointer;
  transition: background-color 0.15s;
}

.toggle-button:not(:last-child) {
  border-right: 1px solid var(--vscode-panel-border);
}

.toggle-button:hover:not(.active) {
  background: var(--vscode-button-secondaryHoverBackground);
}

.toggle-button.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.depth-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.depth-label {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.depth-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.depth-button:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground);
}

.depth-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.depth-value {
  min-width: 20px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
}
```

**Step 5: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/components/treemap/TreemapControls.test.tsx
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add webview-ui/src/components/treemap/TreemapControls.*
git commit -m "feat(treemap): extract Controls into separate component with depth control"
```

---

### Task 1.10: Create Layout Hook

**Files:**
- Create: `webview-ui/src/components/treemap/hooks/useTreemapLayout.ts`
- Create: `webview-ui/src/components/treemap/hooks/useTreemapLayout.test.ts`

**Step 1: Write failing tests**

```typescript
// webview-ui/src/components/treemap/hooks/useTreemapLayout.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTreemapLayout } from './useTreemapLayout'
import type { TreemapNode } from '../../../types'

const mockTree: TreemapNode = {
  name: 'root',
  path: '',
  type: 'directory',
  lines: 1000,
  children: [
    { name: 'file1.ts', path: 'file1.ts', type: 'file', lines: 600 },
    { name: 'file2.ts', path: 'file2.ts', type: 'file', lines: 400 },
  ],
}

describe('useTreemapLayout', () => {
  it('should return null layout when node is null', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(null, 500, 400, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    )
    expect(result.current.layout).toBeNull()
  })

  it('should return null layout when dimensions are zero', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(mockTree, 0, 0, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    )
    expect(result.current.layout).toBeNull()
  })

  it('should calculate layout for valid tree', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(mockTree, 500, 400, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    )
    expect(result.current.layout).not.toBeNull()
    expect(result.current.layout?.x0).toBe(0)
    expect(result.current.layout?.y0).toBe(0)
    expect(result.current.layout?.x1).toBe(500)
    expect(result.current.layout?.y1).toBe(400)
  })

  it('should provide findNodeAtPoint function', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(mockTree, 500, 400, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    )
    expect(typeof result.current.findNodeAtPoint).toBe('function')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/components/treemap/hooks/useTreemapLayout.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement the layout hook**

```typescript
// webview-ui/src/components/treemap/hooks/useTreemapLayout.ts
import { useMemo, useCallback } from 'react'
import * as d3 from 'd3-hierarchy'
import type { TreemapNode } from '../../../types'
import type { TreemapConfig, LayoutNode } from '../types'

interface TreemapLayoutResult {
  layout: LayoutNode | null
  allNodes: LayoutNode[]
  findNodeAtPoint: (x: number, y: number) => LayoutNode | null
}

function createLayoutNode(
  d3Node: d3.HierarchyRectangularNode<TreemapNode>,
  config: TreemapConfig,
  depth: number = 0
): LayoutNode {
  const width = d3Node.x1 - d3Node.x0
  const isLeaf = !d3Node.children || depth >= config.maxNestingDepth
  const hasLabelStrip = !isLeaf && width >= config.labelMinWidth

  const node: LayoutNode = {
    data: d3Node.data,
    x0: d3Node.x0,
    y0: d3Node.y0,
    x1: d3Node.x1,
    y1: d3Node.y1,
    depth,
    hasLabelStrip,
    isLeaf,
  }

  if (!isLeaf && d3Node.children) {
    // Adjust children bounds if this node has a label strip
    const childY0 = hasLabelStrip ? d3Node.y0 + config.labelHeight : d3Node.y0
    const childHeight = d3Node.y1 - childY0
    const childWidth = width

    if (childHeight > 0 && childWidth > 0) {
      // Re-layout children within the adjusted bounds
      const childRoot = d3.hierarchy(d3Node.data)
        .sum(n => n.type === 'file' ? (n.lines || 1) : 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0))

      const childTreemap = d3.treemap<TreemapNode>()
        .size([childWidth, childHeight])
        .paddingInner(0)
        .round(true)

      childTreemap(childRoot)

      node.children = (childRoot.children || []).map(child => {
        const childNode = createLayoutNode(
          {
            ...child,
            x0: d3Node.x0 + child.x0,
            y0: childY0 + child.y0,
            x1: d3Node.x0 + child.x1,
            y1: childY0 + child.y1,
          } as d3.HierarchyRectangularNode<TreemapNode>,
          config,
          depth + 1
        )
        childNode.parent = node
        return childNode
      })
    }
  }

  return node
}

function collectAllNodes(node: LayoutNode): LayoutNode[] {
  const nodes: LayoutNode[] = [node]
  if (node.children) {
    for (const child of node.children) {
      nodes.push(...collectAllNodes(child))
    }
  }
  return nodes
}

export function useTreemapLayout(
  root: TreemapNode | null,
  width: number,
  height: number,
  config: TreemapConfig
): TreemapLayoutResult {
  const layout = useMemo(() => {
    if (!root || width <= 0 || height <= 0) return null

    const hierarchy = d3.hierarchy(root)
      .sum(n => n.type === 'file' ? (n.lines || 1) : 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const treemap = d3.treemap<TreemapNode>()
      .size([width, height])
      .paddingInner(0)
      .round(true)

    const d3Layout = treemap(hierarchy)
    return createLayoutNode(d3Layout, config, 0)
  }, [root, width, height, config])

  const allNodes = useMemo(() => {
    if (!layout) return []
    return collectAllNodes(layout)
  }, [layout])

  const findNodeAtPoint = useCallback((x: number, y: number): LayoutNode | null => {
    // Search from deepest to shallowest to find the most specific node
    const sortedByDepth = [...allNodes].sort((a, b) => b.depth - a.depth)

    for (const node of sortedByDepth) {
      if (x >= node.x0 && x < node.x1 && y >= node.y0 && y < node.y1) {
        // For non-leaf nodes, only match if in label strip area
        if (!node.isLeaf && node.hasLabelStrip) {
          const labelY1 = node.y0 + 18 // labelHeight
          if (y < labelY1) {
            return node
          }
        } else if (node.isLeaf) {
          return node
        }
      }
    }

    return null
  }, [allNodes])

  return { layout, allNodes, findNodeAtPoint }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/components/treemap/hooks/useTreemapLayout.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add webview-ui/src/components/treemap/hooks/
git commit -m "feat(treemap): add useTreemapLayout hook with nested hierarchy support"
```

---

### Task 1.11: Create Hooks Index

**Files:**
- Create: `webview-ui/src/components/treemap/hooks/index.ts`

**Step 1: Create the index file**

```typescript
// webview-ui/src/components/treemap/hooks/index.ts
export { useTreemapLayout } from './useTreemapLayout'
```

**Step 2: Commit**

```bash
git add webview-ui/src/components/treemap/hooks/index.ts
git commit -m "feat(treemap): add hooks index"
```

---

### Task 1.12: Update Store with New State

**Files:**
- Modify: `webview-ui/src/store/index.ts`
- Modify: `webview-ui/src/store/index.test.ts`

**Step 1: Write failing tests for new state**

Add to existing test file:

```typescript
// Add to webview-ui/src/store/index.test.ts

describe('treemap new state', () => {
  it('should have default sizeDisplayMode of loc', () => {
    const state = useStore.getState()
    expect(state.sizeDisplayMode).toBe('loc')
  })

  it('should have default maxNestingDepth of 3', () => {
    const state = useStore.getState()
    expect(state.maxNestingDepth).toBe(3)
  })

  it('should update sizeDisplayMode', () => {
    useStore.getState().setSizeDisplayMode('files')
    expect(useStore.getState().sizeDisplayMode).toBe('files')
  })

  it('should update maxNestingDepth', () => {
    useStore.getState().setMaxNestingDepth(5)
    expect(useStore.getState().maxNestingDepth).toBe(5)
  })

  it('should track hoveredNode', () => {
    const mockNode = { name: 'test', path: 'test', type: 'file' as const, lines: 100 }
    useStore.getState().setHoveredNode(mockNode)
    expect(useStore.getState().hoveredNode).toEqual(mockNode)
  })

  it('should track selectedNode', () => {
    const mockNode = { name: 'test', path: 'test', type: 'file' as const, lines: 100 }
    useStore.getState().setSelectedNode(mockNode)
    expect(useStore.getState().selectedNode).toEqual(mockNode)
  })

  it('should clear selection', () => {
    const mockNode = { name: 'test', path: 'test', type: 'file' as const, lines: 100 }
    useStore.getState().setSelectedNode(mockNode)
    useStore.getState().clearSelection()
    expect(useStore.getState().selectedNode).toBeNull()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- webview-ui/src/store/index.test.ts
```

Expected: FAIL - properties/methods don't exist

**Step 3: Add new state to store**

Add to the store state interface and implementation in `webview-ui/src/store/index.ts`:

```typescript
// Add to state interface
sizeDisplayMode: 'loc' | 'files'
maxNestingDepth: number
hoveredNode: TreemapNode | null
selectedNode: TreemapNode | null

// Add to actions
setSizeDisplayMode: (mode: 'loc' | 'files') => void
setMaxNestingDepth: (depth: number) => void
setHoveredNode: (node: TreemapNode | null) => void
setSelectedNode: (node: TreemapNode | null) => void
clearSelection: () => void

// Add to initial state
sizeDisplayMode: 'loc',
maxNestingDepth: 3,
hoveredNode: null,
selectedNode: null,

// Add to store implementation
setSizeDisplayMode: (mode) => set({ sizeDisplayMode: mode }),
setMaxNestingDepth: (depth) => set({ maxNestingDepth: depth }),
setHoveredNode: (node) => set({ hoveredNode: node }),
setSelectedNode: (node) => set({ selectedNode: node }),
clearSelection: () => set({ selectedNode: null }),
```

**Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- webview-ui/src/store/index.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add webview-ui/src/store/
git commit -m "feat(treemap): add new state for size mode, nesting depth, and selection"
```

---

## Phase 1 Checkpoint

After completing Phase 1:

1. Run all tests: `npm run test:unit`
2. Run typecheck: `npm run typecheck`
3. Run lint: `npm run lint`
4. Verify the app still works: `npm run build && npm run watch`

Expected: All checks pass, no visual changes yet (existing TreemapPanel unchanged)

---

## Phase 2: Nested Hierarchy Rendering

Transform the canvas rendering to display nested directory containers.

### Task 2.1: Create Canvas Rendering Hook

**Files:**
- Create: `webview-ui/src/components/treemap/hooks/useTreemapRender.ts`

**Step 1: Implement the rendering hook**

```typescript
// webview-ui/src/components/treemap/hooks/useTreemapRender.ts
import { useCallback, useRef } from 'react'
import type { TreemapNode, ColorMode } from '../../../types'
import type { LayoutNode, SizeDisplayMode } from '../types'
import { drawVignetteTile } from '../utils/vignette'
import { getContrastColor, DIRECTORY_COLOR, HOVER_OVERLAY_COLOR, SELECTION_BORDER_COLOR, HOVER_BORDER_COLOR } from '../utils/colors'
import { getLanguageColor, getAgeColor, formatNumber } from '../../../utils/colors'

interface RenderOptions {
  colorMode: ColorMode
  sizeMode: SizeDisplayMode
  hoveredNode: TreemapNode | null
  selectedNode: TreemapNode | null
  devicePixelRatio: number
}

const LABEL_HEIGHT = 18
const MIN_LABEL_WIDTH = 60
const MIN_LABEL_HEIGHT = 20

function getNodeColor(node: TreemapNode, colorMode: ColorMode): string {
  if (node.type === 'directory') {
    return DIRECTORY_COLOR
  }
  if (colorMode === 'age' && node.lastModified) {
    return getAgeColor(node.lastModified)
  }
  return getLanguageColor(node.language || 'Unknown')
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const ellipsis = '...'
  let width = ctx.measureText(text).width
  if (width <= maxWidth) return text

  while (width > maxWidth && text.length > 0) {
    text = text.slice(0, -1)
    width = ctx.measureText(text + ellipsis).width
  }
  return text + ellipsis
}

export function useTreemapRender() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const render = useCallback((
    canvas: HTMLCanvasElement,
    allNodes: LayoutNode[],
    options: RenderOptions
  ) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { colorMode, sizeMode, hoveredNode, selectedNode, devicePixelRatio } = options
    const dpr = devicePixelRatio

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    // Sort nodes by depth (back to front)
    const sortedNodes = [...allNodes].sort((a, b) => a.depth - b.depth)

    // Pass 1: Draw all tiles with vignette
    for (const node of sortedNodes) {
      const color = getNodeColor(node.data, colorMode)
      drawVignetteTile(ctx, node.x0, node.y0, node.x1, node.y1, color)
    }

    // Pass 2: Draw labels
    ctx.font = '11px var(--vscode-font-family, sans-serif)'
    ctx.textBaseline = 'middle'

    for (const node of sortedNodes) {
      const width = node.x1 - node.x0
      const height = node.y1 - node.y0

      // Directory label (in label strip)
      if (!node.isLeaf && node.hasLabelStrip && width >= MIN_LABEL_WIDTH) {
        const color = getNodeColor(node.data, colorMode)
        ctx.fillStyle = getContrastColor(color)

        const lines = node.data.lines || 0
        const sizeText = sizeMode === 'loc'
          ? `(${formatNumber(lines)})`
          : `(${formatNumber(countFiles(node.data))} files)`
        const label = `${node.data.name}/ ${sizeText}`
        const truncated = truncateText(ctx, label, width - 8)

        ctx.fillText(truncated, node.x0 + 4, node.y0 + LABEL_HEIGHT / 2)
      }

      // File label (centered if space permits)
      if (node.isLeaf && width >= MIN_LABEL_WIDTH && height >= MIN_LABEL_HEIGHT) {
        const color = getNodeColor(node.data, colorMode)
        ctx.fillStyle = getContrastColor(color)

        const truncated = truncateText(ctx, node.data.name, width - 8)
        const textY = node.y0 + height / 2
        ctx.fillText(truncated, node.x0 + 4, textY)
      }
    }

    // Pass 3: Draw hover highlight
    if (hoveredNode) {
      const hovered = allNodes.find(n => n.data.path === hoveredNode.path)
      if (hovered) {
        // Brightness overlay
        ctx.fillStyle = HOVER_OVERLAY_COLOR
        ctx.fillRect(hovered.x0, hovered.y0, hovered.x1 - hovered.x0, hovered.y1 - hovered.y0)

        // Border
        ctx.strokeStyle = HOVER_BORDER_COLOR
        ctx.lineWidth = 2
        ctx.strokeRect(hovered.x0 + 1, hovered.y0 + 1, hovered.x1 - hovered.x0 - 2, hovered.y1 - hovered.y0 - 2)
      }
    }

    // Pass 4: Draw selection
    if (selectedNode) {
      const selected = allNodes.find(n => n.data.path === selectedNode.path)
      if (selected) {
        ctx.strokeStyle = SELECTION_BORDER_COLOR
        ctx.lineWidth = 2
        ctx.strokeRect(selected.x0 + 1, selected.y0 + 1, selected.x1 - selected.x0 - 2, selected.y1 - selected.y0 - 2)
      }
    }

    ctx.restore()
  }, [])

  return { canvasRef, render }
}

function countFiles(node: TreemapNode): number {
  if (node.type === 'file') return 1
  return (node.children || []).reduce((sum, child) => sum + countFiles(child), 0)
}
```

**Step 2: Update hooks index**

```typescript
// webview-ui/src/components/treemap/hooks/index.ts
export { useTreemapLayout } from './useTreemapLayout'
export { useTreemapRender } from './useTreemapRender'
```

**Step 3: Commit**

```bash
git add webview-ui/src/components/treemap/hooks/
git commit -m "feat(treemap): add useTreemapRender hook with vignette and hierarchy support"
```

---

### Task 2.2: Create Interactions Hook

**Files:**
- Create: `webview-ui/src/components/treemap/hooks/useTreemapInteractions.ts`

**Step 1: Implement the interactions hook**

```typescript
// webview-ui/src/components/treemap/hooks/useTreemapInteractions.ts
import { useCallback, useEffect, useRef } from 'react'
import type { TreemapNode } from '../../../types'
import type { LayoutNode, TooltipState, ContextMenuState } from '../types'

interface InteractionCallbacks {
  onHover: (node: TreemapNode | null) => void
  onSelect: (node: TreemapNode | null) => void
  onNavigate: (path: string[]) => void
  onOpenFile: (path: string) => void
}

interface InteractionState {
  tooltip: TooltipState
  contextMenu: ContextMenuState
}

export function useTreemapInteractions(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  findNodeAtPoint: (x: number, y: number) => LayoutNode | null,
  callbacks: InteractionCallbacks,
  currentPath: string[]
) {
  const tooltipState = useRef<TooltipState>({ visible: false, x: 0, y: 0, node: null })
  const contextMenuState = useRef<ContextMenuState>({ visible: false, x: 0, y: 0, node: null })
  const lastHoverTime = useRef(0)

  const getState = useCallback((): InteractionState => ({
    tooltip: tooltipState.current,
    contextMenu: contextMenuState.current,
  }), [])

  const setTooltip = useCallback((state: Partial<TooltipState>) => {
    tooltipState.current = { ...tooltipState.current, ...state }
  }, [])

  const setContextMenu = useCallback((state: Partial<ContextMenuState>) => {
    contextMenuState.current = { ...contextMenuState.current, ...state }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Throttle to 60fps
    const now = performance.now()
    if (now - lastHoverTime.current < 16) return
    lastHoverTime.current = now

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const node = findNodeAtPoint(x, y)
    callbacks.onHover(node?.data || null)

    setTooltip({
      visible: !!node,
      x: e.clientX,
      y: e.clientY,
      node: node?.data || null,
    })
  }, [canvasRef, findNodeAtPoint, callbacks, setTooltip])

  const handleMouseLeave = useCallback(() => {
    callbacks.onHover(null)
    setTooltip({ visible: false, node: null })
  }, [callbacks, setTooltip])

  const handleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const node = findNodeAtPoint(x, y)
    callbacks.onSelect(node?.data || null)
  }, [canvasRef, findNodeAtPoint, callbacks])

  const handleDoubleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const node = findNodeAtPoint(x, y)
    if (!node) return

    if (node.data.type === 'file') {
      callbacks.onOpenFile(node.data.path)
    } else {
      // Navigate into directory
      const pathParts = node.data.path.split('/').filter(Boolean)
      callbacks.onNavigate(pathParts)
    }
  }, [canvasRef, findNodeAtPoint, callbacks])

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const node = findNodeAtPoint(x, y)
    if (node) {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node: node.data,
      })
    }
  }, [canvasRef, findNodeAtPoint, setContextMenu])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      callbacks.onSelect(null)
      setContextMenu({ visible: false })
    } else if (e.key === 'Backspace') {
      if (currentPath.length > 0) {
        callbacks.onNavigate(currentPath.slice(0, -1))
      }
    }
  }, [callbacks, currentPath, setContextMenu])

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false })
  }, [setContextMenu])

  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('dblclick', handleDoubleClick)
    canvas.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('dblclick', handleDoubleClick)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [canvasRef, handleMouseMove, handleMouseLeave, handleClick, handleDoubleClick, handleContextMenu, handleKeyDown])

  return {
    getState,
    closeContextMenu,
  }
}
```

**Step 2: Update hooks index**

```typescript
// webview-ui/src/components/treemap/hooks/index.ts
export { useTreemapLayout } from './useTreemapLayout'
export { useTreemapRender } from './useTreemapRender'
export { useTreemapInteractions } from './useTreemapInteractions'
```

**Step 3: Commit**

```bash
git add webview-ui/src/components/treemap/hooks/
git commit -m "feat(treemap): add useTreemapInteractions hook with click, hover, keyboard support"
```

---

### Task 2.3: Create New TreemapCanvas Component

**Files:**
- Create: `webview-ui/src/components/treemap/TreemapCanvas.tsx`

**Step 1: Implement the canvas component**

```typescript
// webview-ui/src/components/treemap/TreemapCanvas.tsx
import { useRef, useEffect, useState, useCallback } from 'react'
import type { TreemapNode, ColorMode } from '../../types'
import type { TreemapConfig, SizeDisplayMode } from './types'
import { DEFAULT_TREEMAP_CONFIG } from './types'
import { useTreemapLayout } from './hooks/useTreemapLayout'
import { useTreemapRender } from './hooks/useTreemapRender'
import { useTreemapInteractions } from './hooks/useTreemapInteractions'
import { TreemapTooltip } from './TreemapTooltip'
import { TreemapContextMenu } from './TreemapContextMenu'

interface TreemapCanvasProps {
  root: TreemapNode | null
  colorMode: ColorMode
  sizeMode: SizeDisplayMode
  maxNestingDepth: number
  hoveredNode: TreemapNode | null
  selectedNode: TreemapNode | null
  currentPath: string[]
  onHover: (node: TreemapNode | null) => void
  onSelect: (node: TreemapNode | null) => void
  onNavigate: (path: string[]) => void
  onOpenFile: (path: string) => void
  onRevealInExplorer: (path: string) => void
  onCopyPath: (path: string) => void
}

export function TreemapCanvas({
  root,
  colorMode,
  sizeMode,
  maxNestingDepth,
  hoveredNode,
  selectedNode,
  currentPath,
  onHover,
  onSelect,
  onNavigate,
  onOpenFile,
  onRevealInExplorer,
  onCopyPath,
}: TreemapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [tooltipState, setTooltipState] = useState({ visible: false, x: 0, y: 0, node: null as TreemapNode | null })
  const [contextMenuState, setContextMenuState] = useState({ visible: false, x: 0, y: 0, node: null as TreemapNode | null })

  const config: TreemapConfig = {
    ...DEFAULT_TREEMAP_CONFIG,
    maxNestingDepth,
  }

  const { layout, allNodes, findNodeAtPoint } = useTreemapLayout(root, dimensions.width, dimensions.height, config)
  const { render } = useTreemapRender()

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    canvas.style.width = `${dimensions.width}px`
    canvas.style.height = `${dimensions.height}px`
  }, [dimensions])

  // Render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || allNodes.length === 0) return

    render(canvas, allNodes, {
      colorMode,
      sizeMode,
      hoveredNode,
      selectedNode,
      devicePixelRatio: window.devicePixelRatio || 1,
    })
  }, [allNodes, colorMode, sizeMode, hoveredNode, selectedNode, render])

  // Mouse move handler (throttled)
  const lastMoveTime = useRef(0)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const now = performance.now()
    if (now - lastMoveTime.current < 16) return
    lastMoveTime.current = now

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const node = findNodeAtPoint(x, y)
    onHover(node?.data || null)

    setTooltipState({
      visible: !!node,
      x: e.clientX,
      y: e.clientY,
      node: node?.data || null,
    })
  }, [findNodeAtPoint, onHover])

  const handleMouseLeave = useCallback(() => {
    onHover(null)
    setTooltipState(prev => ({ ...prev, visible: false }))
  }, [onHover])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const node = findNodeAtPoint(x, y)
    onSelect(node?.data || null)
  }, [findNodeAtPoint, onSelect])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const node = findNodeAtPoint(x, y)
    if (!node) return

    if (node.data.type === 'file') {
      onOpenFile(node.data.path)
    } else {
      const pathParts = node.data.path.split('/').filter(Boolean)
      onNavigate(pathParts)
    }
  }, [findNodeAtPoint, onOpenFile, onNavigate])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const node = findNodeAtPoint(x, y)
    if (node) {
      setContextMenuState({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node: node.data,
      })
    }
  }, [findNodeAtPoint])

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelect(null)
        setContextMenuState(prev => ({ ...prev, visible: false }))
      } else if (e.key === 'Backspace' && currentPath.length > 0) {
        e.preventDefault()
        onNavigate(currentPath.slice(0, -1))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentPath, onNavigate, onSelect])

  return (
    <div ref={containerRef} className="treemap-canvas-container">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      <TreemapTooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        node={tooltipState.node}
        sizeMode={sizeMode}
      />
      <TreemapContextMenu
        visible={contextMenuState.visible}
        x={contextMenuState.x}
        y={contextMenuState.y}
        node={contextMenuState.node}
        onOpenFile={onOpenFile}
        onRevealInExplorer={onRevealInExplorer}
        onCopyPath={onCopyPath}
        onClose={() => setContextMenuState(prev => ({ ...prev, visible: false }))}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add webview-ui/src/components/treemap/TreemapCanvas.tsx
git commit -m "feat(treemap): add TreemapCanvas component with nested hierarchy rendering"
```

---

### Task 2.4: Refactor TreemapPanel to Use New Components

**Files:**
- Modify: `webview-ui/src/components/treemap/TreemapPanel.tsx`
- Modify: `webview-ui/src/components/treemap/TreemapPanel.css`

**Step 1: Rewrite TreemapPanel to orchestrate new components**

Replace the entire file with the new modular implementation that uses all the extracted components:

```typescript
// webview-ui/src/components/treemap/TreemapPanel.tsx
import { useStore } from '../../store'
import { useVsCodeApi } from '../../hooks/useVsCodeApi'
import { TreemapCanvas } from './TreemapCanvas'
import { TreemapFilter } from './TreemapFilter'
import { TreemapControls } from './TreemapControls'
import { TreemapBreadcrumb } from './TreemapBreadcrumb'
import { TreemapLegend } from './TreemapLegend'
import { collectLanguageCounts } from './utils/layout'
import './TreemapPanel.css'

export function TreemapPanel() {
  const { openFile, revealInExplorer, copyPath } = useVsCodeApi()

  // Store state
  const currentTreemapNode = useStore(state => state.currentTreemapNode)
  const treemapPath = useStore(state => state.treemapPath)
  const colorMode = useStore(state => state.colorMode)
  const sizeDisplayMode = useStore(state => state.sizeDisplayMode)
  const maxNestingDepth = useStore(state => state.maxNestingDepth)
  const hoveredNode = useStore(state => state.hoveredNode)
  const selectedNode = useStore(state => state.selectedNode)

  // Store actions
  const navigateToTreemapPath = useStore(state => state.navigateToTreemapPath)
  const setColorMode = useStore(state => state.setColorMode)
  const setSizeDisplayMode = useStore(state => state.setSizeDisplayMode)
  const setMaxNestingDepth = useStore(state => state.setMaxNestingDepth)
  const setHoveredNode = useStore(state => state.setHoveredNode)
  const setSelectedNode = useStore(state => state.setSelectedNode)

  // Calculate language counts for legend
  const languageCounts = currentTreemapNode
    ? collectLanguageCounts(currentTreemapNode)
    : new Map<string, number>()

  if (!currentTreemapNode) {
    return (
      <div className="treemap-panel">
        <div className="treemap-empty">
          <p>No data available</p>
          <p className="treemap-empty-hint">Run analysis to generate treemap</p>
        </div>
      </div>
    )
  }

  return (
    <div className="treemap-panel">
      <div className="treemap-header">
        <TreemapFilter />
        <TreemapControls
          colorMode={colorMode}
          sizeMode={sizeDisplayMode}
          nestingDepth={maxNestingDepth}
          onColorModeChange={setColorMode}
          onSizeModeChange={setSizeDisplayMode}
          onNestingDepthChange={setMaxNestingDepth}
        />
      </div>

      <TreemapBreadcrumb
        path={treemapPath}
        onNavigate={navigateToTreemapPath}
      />

      <div className="treemap-content">
        <TreemapCanvas
          root={currentTreemapNode}
          colorMode={colorMode}
          sizeMode={sizeDisplayMode}
          maxNestingDepth={maxNestingDepth}
          hoveredNode={hoveredNode}
          selectedNode={selectedNode}
          currentPath={treemapPath}
          onHover={setHoveredNode}
          onSelect={setSelectedNode}
          onNavigate={navigateToTreemapPath}
          onOpenFile={openFile}
          onRevealInExplorer={revealInExplorer}
          onCopyPath={copyPath}
        />
      </div>

      <TreemapLegend
        colorMode={colorMode}
        languageCounts={languageCounts}
      />
    </div>
  )
}
```

**Step 2: Update CSS**

```css
/* webview-ui/src/components/treemap/TreemapPanel.css */
.treemap-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--vscode-editor-background);
}

.treemap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.treemap-content {
  flex: 1;
  min-height: 0;
  position: relative;
}

.treemap-canvas-container {
  width: 100%;
  height: 100%;
}

.treemap-canvas-container canvas {
  display: block;
}

.treemap-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vscode-descriptionForeground);
}

.treemap-empty-hint {
  font-size: 12px;
  margin-top: 8px;
}
```

**Step 3: Create layout utils helper**

```typescript
// webview-ui/src/components/treemap/utils/layout.ts
import type { TreemapNode } from '../../../types'

/**
 * Collect language counts from a treemap node
 */
export function collectLanguageCounts(node: TreemapNode): Map<string, number> {
  const counts = new Map<string, number>()

  function traverse(n: TreemapNode) {
    if (n.type === 'file' && n.language) {
      counts.set(n.language, (counts.get(n.language) || 0) + (n.lines || 0))
    }
    if (n.children) {
      n.children.forEach(traverse)
    }
  }

  traverse(node)
  return counts
}
```

**Step 4: Update utils index**

```typescript
// webview-ui/src/components/treemap/utils/index.ts
export * from './colors'
export * from './vignette'
export * from './layout'
```

**Step 5: Run typecheck and tests**

```bash
npm run typecheck
npm run test:unit
```

**Step 6: Commit**

```bash
git add webview-ui/src/components/treemap/
git commit -m "refactor(treemap): integrate new modular components into TreemapPanel"
```

---

## Phase 2 Checkpoint

After completing Phase 2:

1. Run all tests: `npm run test:unit`
2. Run typecheck: `npm run typecheck`
3. Build and test visually: `npm run build`
4. Open extension and verify nested hierarchy is visible

Expected: Treemap now shows nested directories with vignette shading

---

## Phases 3-6: Remaining Implementation

The remaining phases follow the same TDD pattern:

### Phase 3: Vignette Tuning
- Adjust gradient parameters for visual appeal
- Test different brightness ratios
- Optimize gradient performance

### Phase 4: New Interactions
- Verify single-click selection works
- Verify double-click navigation works
- Test keyboard shortcuts (Escape, Backspace)
- Test Enter key to open/navigate selected item

### Phase 5: UI Controls
- Integrate TreemapFilter with TreemapControls
- Verify size toggle (LOC/Files) updates display
- Verify depth control changes nesting

### Phase 6: Performance
- Profile with large repos (10K+ files)
- Implement dirty-rect rendering if needed
- Cache layout calculations
- Optimize gradient reuse

---

## Final Validation

Before merging:

```bash
npm run validate
```

This runs typecheck, lint, all tests, and creates a package.

---

## Component Index

Create final index file for clean imports:

```typescript
// webview-ui/src/components/treemap/index.ts
export { TreemapPanel } from './TreemapPanel'
export { TreemapCanvas } from './TreemapCanvas'
export { TreemapControls } from './TreemapControls'
export { TreemapBreadcrumb } from './TreemapBreadcrumb'
export { TreemapTooltip } from './TreemapTooltip'
export { TreemapContextMenu } from './TreemapContextMenu'
export { TreemapLegend } from './TreemapLegend'
export { TreemapFilter } from './TreemapFilter'
export * from './types'
export * from './hooks'
export * from './utils'
```
