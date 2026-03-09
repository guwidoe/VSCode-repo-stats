import type { ComponentProps } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreemapContextMenu } from './TreemapContextMenu';
import type { TreemapNode } from '../../types';

const mockFileNode: TreemapNode = {
  name: 'index.ts',
  path: 'src/components/index.ts',
  type: 'file',
  lines: 150,
};

const mockDirNode: TreemapNode = {
  name: 'components',
  path: 'src/components',
  type: 'directory',
  lines: 5000,
};

function renderMenu(node: TreemapNode | null, overrides: Partial<ComponentProps<typeof TreemapContextMenu>> = {}) {
  const props: ComponentProps<typeof TreemapContextMenu> = {
    visible: true,
    x: 100,
    y: 100,
    node,
    onOpenFile: vi.fn(),
    onRevealInExplorer: vi.fn(),
    onCopyPath: vi.fn(),
    onAddToRepoExcludePatterns: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<TreemapContextMenu {...props} />),
    props,
  };
}

describe('TreemapContextMenu', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
        onAddToRepoExcludePatterns={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should not render when node is null', () => {
    const { container } = render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={null}
        onOpenFile={vi.fn()}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onAddToRepoExcludePatterns={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should show Open File option for files', () => {
    renderMenu(mockFileNode);
    expect(screen.getByText('Open File')).toBeInTheDocument();
  });

  it('should not show Open File option for directories', () => {
    renderMenu(mockDirNode);
    expect(screen.queryByText('Open File')).not.toBeInTheDocument();
  });

  it('should call onOpenFile when clicking Open File', () => {
    const onOpenFile = vi.fn();
    const onClose = vi.fn();
    renderMenu(mockFileNode, { onOpenFile, onClose });

    fireEvent.click(screen.getByText('Open File'));
    expect(onOpenFile).toHaveBeenCalledWith(mockFileNode.path);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onRevealInExplorer when clicking Reveal in Explorer', () => {
    const onRevealInExplorer = vi.fn();
    const onClose = vi.fn();
    renderMenu(mockFileNode, { onRevealInExplorer, onClose });

    fireEvent.click(screen.getByText('Reveal in Explorer'));
    expect(onRevealInExplorer).toHaveBeenCalledWith(mockFileNode.path);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onCopyPath when clicking Copy Path', () => {
    const onCopyPath = vi.fn();
    const onClose = vi.fn();
    renderMenu(mockFileNode, { onCopyPath, onClose });

    fireEvent.click(screen.getByText('Copy Path'));
    expect(onCopyPath).toHaveBeenCalledWith(mockFileNode.path);
    expect(onClose).toHaveBeenCalled();
  });

  it('should add the node to repo exclude patterns from the context menu', () => {
    const onAddToRepoExcludePatterns = vi.fn();
    const onClose = vi.fn();
    renderMenu(mockDirNode, { onAddToRepoExcludePatterns, onClose });

    fireEvent.click(screen.getByText('Add to Repo Exclude Patterns'));
    expect(onAddToRepoExcludePatterns).toHaveBeenCalledWith(mockDirNode);
    expect(onClose).toHaveBeenCalled();
  });

  it('should position the menu at the specified coordinates when there is room', () => {
    renderMenu(mockFileNode, { x: 150, y: 200 });

    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '150px', top: '200px' });
  });

  it('should clamp the menu inside the viewport near the right and bottom edges', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      top: 0,
      right: 120,
      bottom: 80,
      left: 0,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 160 });

    renderMenu(mockFileNode, { x: 190, y: 150 });

    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '72px', top: '72px' });
  });

  it('should close on Escape key press', () => {
    const onClose = vi.fn();
    renderMenu(mockFileNode, { onClose });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should close on click outside', () => {
    const onClose = vi.fn();
    renderMenu(mockFileNode, { onClose });

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('should show Reveal in Explorer and Copy Path for directories', () => {
    renderMenu(mockDirNode);
    expect(screen.getByText('Reveal in Explorer')).toBeInTheDocument();
    expect(screen.getByText('Copy Path')).toBeInTheDocument();
  });
});
