import { describe, it, expect, vi } from 'vitest';
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
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

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
    );
    expect(screen.getByText('Open File')).toBeInTheDocument();
  });

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
    );
    expect(screen.queryByText('Open File')).not.toBeInTheDocument();
  });

  it('should call onOpenFile when clicking Open File', () => {
    const onOpenFile = vi.fn();
    const onClose = vi.fn();
    render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={mockFileNode}
        onOpenFile={onOpenFile}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText('Open File'));
    expect(onOpenFile).toHaveBeenCalledWith(mockFileNode.path);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onRevealInExplorer when clicking Reveal in Explorer', () => {
    const onRevealInExplorer = vi.fn();
    const onClose = vi.fn();
    render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={mockFileNode}
        onOpenFile={vi.fn()}
        onRevealInExplorer={onRevealInExplorer}
        onCopyPath={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText('Reveal in Explorer'));
    expect(onRevealInExplorer).toHaveBeenCalledWith(mockFileNode.path);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onCopyPath when clicking Copy Path', () => {
    const onCopyPath = vi.fn();
    const onClose = vi.fn();
    render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={mockFileNode}
        onOpenFile={vi.fn()}
        onRevealInExplorer={vi.fn()}
        onCopyPath={onCopyPath}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText('Copy Path'));
    expect(onCopyPath).toHaveBeenCalledWith(mockFileNode.path);
    expect(onClose).toHaveBeenCalled();
  });

  it('should position the menu at the specified coordinates', () => {
    render(
      <TreemapContextMenu
        visible={true}
        x={150}
        y={200}
        node={mockFileNode}
        onOpenFile={vi.fn()}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '150px', top: '200px' });
  });

  it('should close on Escape key press', () => {
    const onClose = vi.fn();
    render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={mockFileNode}
        onOpenFile={vi.fn()}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should close on click outside', () => {
    const onClose = vi.fn();
    render(
      <TreemapContextMenu
        visible={true}
        x={100}
        y={100}
        node={mockFileNode}
        onOpenFile={vi.fn()}
        onRevealInExplorer={vi.fn()}
        onCopyPath={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('should show Reveal in Explorer for directories', () => {
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
    );
    expect(screen.getByText('Reveal in Explorer')).toBeInTheDocument();
    expect(screen.getByText('Copy Path')).toBeInTheDocument();
  });
});
