// webview-ui/src/components/treemap/TreemapTooltip.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreemapTooltip } from './TreemapTooltip';
import type { TreemapNode } from '../../types';

const mockFileNode: TreemapNode = {
  name: 'index.ts',
  path: 'src/components/index.ts',
  type: 'file',
  lines: 150,
  language: 'TypeScript',
  lastModified: '2026-01-15T10:00:00Z',
};

const mockDirNode: TreemapNode = {
  name: 'components',
  path: 'src/components',
  type: 'directory',
  lines: 5000,
  children: [],
};

describe('TreemapTooltip', () => {
  it('should not render when not visible', () => {
    const { container } = render(
      <TreemapTooltip visible={false} x={0} y={0} node={mockFileNode} sizeMode="loc" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render file info when visible', () => {
    render(<TreemapTooltip visible={true} x={100} y={100} node={mockFileNode} sizeMode="loc" />);
    expect(screen.getByText('src/components/index.ts')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText(/150 lines/)).toBeInTheDocument();
  });

  it('should render directory info', () => {
    render(<TreemapTooltip visible={true} x={100} y={100} node={mockDirNode} sizeMode="loc" />);
    expect(screen.getByText('src/components')).toBeInTheDocument();
    expect(screen.getByText(/5.0K lines/)).toBeInTheDocument();
  });

  it('should show file count when sizeMode is files', () => {
    const dirWithChildren: TreemapNode = {
      ...mockDirNode,
      children: [mockFileNode, mockFileNode, mockFileNode],
    };
    render(<TreemapTooltip visible={true} x={100} y={100} node={dirWithChildren} sizeMode="files" />);
    expect(screen.getByText(/3 files/)).toBeInTheDocument();
  });

  it('should not render when node is null', () => {
    const { container } = render(
      <TreemapTooltip visible={true} x={100} y={100} node={null} sizeMode="loc" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should position tooltip correctly', () => {
    render(<TreemapTooltip visible={true} x={200} y={300} node={mockFileNode} sizeMode="loc" />);
    const tooltip = screen.getByText('src/components/index.ts').closest('.treemap-tooltip');
    expect(tooltip).toHaveStyle({ left: '215px', top: '315px' });
  });
});
