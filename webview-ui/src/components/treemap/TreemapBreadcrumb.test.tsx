import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreemapBreadcrumb } from './TreemapBreadcrumb';

describe('TreemapBreadcrumb', () => {
  it('should render root when path is empty', () => {
    render(<TreemapBreadcrumb path={[]} onNavigate={vi.fn()} />);
    expect(screen.getByText('root')).toBeInTheDocument();
  });

  it('should render path segments', () => {
    render(<TreemapBreadcrumb path={['src', 'components']} onNavigate={vi.fn()} />);
    expect(screen.getByText('root')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();
  });

  it('should call onNavigate with correct path when clicking segment', () => {
    const onNavigate = vi.fn();
    render(<TreemapBreadcrumb path={['src', 'components', 'treemap']} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText('src'));
    expect(onNavigate).toHaveBeenCalledWith(['src']);
  });

  it('should navigate to root when clicking root', () => {
    const onNavigate = vi.fn();
    render(<TreemapBreadcrumb path={['src', 'components']} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText('root'));
    expect(onNavigate).toHaveBeenCalledWith([]);
  });

  it('should not make the last segment clickable', () => {
    const onNavigate = vi.fn();
    render(<TreemapBreadcrumb path={['src', 'components']} onNavigate={onNavigate} />);

    const lastSegment = screen.getByText('components');
    fireEvent.click(lastSegment);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('should not call onNavigate when clicking root if already at root', () => {
    const onNavigate = vi.fn();
    render(<TreemapBreadcrumb path={[]} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText('root'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('should render separators between segments', () => {
    render(<TreemapBreadcrumb path={['src', 'components']} onNavigate={vi.fn()} />);
    const separators = screen.getAllByText('/');
    expect(separators).toHaveLength(2);
  });
});
