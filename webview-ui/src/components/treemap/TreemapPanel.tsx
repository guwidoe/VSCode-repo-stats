/**
 * TreemapPanel - Orchestration layer for treemap visualization.
 *
 * Composes modular components:
 * - TreemapCanvas: Canvas-based rendering with D3 layout
 * - TreemapFilter: Filter presets and language selection
 * - TreemapControls: Color mode, size mode, nesting depth
 * - TreemapBreadcrumb: Navigation path
 * - TreemapLegend: Color legend based on mode
 */

import { useStore, selectFilteredTreemapNode } from '../../store';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { TreemapCanvas } from './TreemapCanvas';
import { TreemapFilter } from './TreemapFilter';
import { TreemapControls } from './TreemapControls';
import { TreemapBreadcrumb } from './TreemapBreadcrumb';
import { TreemapLegend } from './TreemapLegend';
import { TreeViewPanel } from './TreeViewPanel';
import { collectLanguageCounts, calculateMaxDepth } from './utils/layout';
import './TreemapPanel.css';

export function TreemapPanel() {
  const { openFile, revealInExplorer, copyPath } = useVsCodeApi();

  // Store state - use the filtered treemap node from the selector
  const filteredTreemapNode = useStore(selectFilteredTreemapNode);
  const treemapPath = useStore(state => state.treemapPath);
  const colorMode = useStore(state => state.colorMode);
  const sizeDisplayMode = useStore(state => state.sizeDisplayMode);
  const maxNestingDepth = useStore(state => state.maxNestingDepth);
  const hoveredNode = useStore(state => state.hoveredNode);
  const selectedNode = useStore(state => state.selectedNode);

  // Store actions
  const navigateToTreemapPath = useStore(state => state.navigateToTreemapPath);
  const setColorMode = useStore(state => state.setColorMode);
  const setSizeDisplayMode = useStore(state => state.setSizeDisplayMode);
  const setMaxNestingDepth = useStore(state => state.setMaxNestingDepth);
  const setHoveredNode = useStore(state => state.setHoveredNode);
  const setSelectedNode = useStore(state => state.setSelectedNode);

  // Get the raw unfiltered node to check if we have data at all
  const data = useStore(state => state.data);
  const treemapFilter = useStore(state => state.treemapFilter);
  const hasData = !!data?.fileTree;

  // Calculate language counts for legend
  const languageCounts = filteredTreemapNode
    ? collectLanguageCounts(filteredTreemapNode)
    : new Map<string, number>();

  // Calculate max depth from raw file tree (not filtered)
  const treeMaxDepth = data?.fileTree ? calculateMaxDepth(data.fileTree) : 5;

  // Determine empty state message
  const isCustomFilterEmpty = hasData && !filteredTreemapNode && treemapFilter.preset === 'custom';
  const isFilterEmpty = hasData && !filteredTreemapNode && treemapFilter.preset !== 'custom';

  if (!hasData) {
    return (
      <div className="treemap-panel">
        <div className="treemap-empty">
          <p>No data available</p>
          <p className="treemap-empty-hint">Run analysis to generate treemap</p>
        </div>
      </div>
    );
  }

  return (
    <div className="treemap-panel">
      <div className="treemap-header">
        <TreemapFilter />
        <TreemapControls
          colorMode={colorMode}
          sizeMode={sizeDisplayMode}
          nestingDepth={maxNestingDepth}
          maxDepth={treeMaxDepth}
          onColorModeChange={setColorMode}
          onSizeModeChange={setSizeDisplayMode}
          onNestingDepthChange={setMaxNestingDepth}
        />
      </div>

      <TreemapBreadcrumb
        path={treemapPath}
        onNavigate={navigateToTreemapPath}
      />

      <TreeViewPanel
        root={filteredTreemapNode}
        colorMode={colorMode}
        selectedPath={selectedNode?.path || null}
        hoveredPath={hoveredNode?.path || null}
        onSelect={setSelectedNode}
        onHover={setHoveredNode}
        onNavigate={navigateToTreemapPath}
      />

      <div className="treemap-content">
        {isCustomFilterEmpty ? (
          <div className="treemap-empty">
            <p>No files match selected languages</p>
            <p className="treemap-empty-hint">Select languages above to see files</p>
          </div>
        ) : isFilterEmpty ? (
          <div className="treemap-empty">
            <p>No files match current filter</p>
            <p className="treemap-empty-hint">Try a different filter preset</p>
          </div>
        ) : filteredTreemapNode ? (
          <TreemapCanvas
            root={filteredTreemapNode}
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
        ) : null}
      </div>

      <TreemapLegend
        colorMode={colorMode}
        languageCounts={languageCounts}
      />
    </div>
  );
}
