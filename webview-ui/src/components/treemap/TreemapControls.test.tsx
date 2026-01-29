import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreemapControls } from './TreemapControls';

describe('TreemapControls', () => {
  const defaultProps = {
    colorMode: 'language' as const,
    sizeMode: 'loc' as const,
    nestingDepth: 3,
    maxDepth: 10,
    onColorModeChange: vi.fn(),
    onSizeModeChange: vi.fn(),
    onNestingDepthChange: vi.fn(),
  };

  it('should render color mode dropdown with all options', () => {
    render(<TreemapControls {...defaultProps} />);
    const colorSelect = screen.getByDisplayValue('Language') as HTMLSelectElement;
    expect(colorSelect).toBeInTheDocument();
    // Check all options are present in color dropdown
    const colorOptions = Array.from(colorSelect.options).map(opt => opt.text);
    expect(colorOptions).toContain('Language');
    expect(colorOptions).toContain('Age');
    expect(colorOptions).toContain('Complexity');
    expect(colorOptions).toContain('Density');
  });

  it('should render size mode dropdown with all options', () => {
    render(<TreemapControls {...defaultProps} />);
    const sizeSelect = screen.getByDisplayValue('LOC') as HTMLSelectElement;
    expect(sizeSelect).toBeInTheDocument();
    // Check all options are present in size dropdown
    const sizeOptions = Array.from(sizeSelect.options).map(opt => opt.text);
    expect(sizeOptions).toContain('LOC');
    expect(sizeOptions).toContain('Bytes');
    expect(sizeOptions).toContain('Files');
    expect(sizeOptions).toContain('Complexity');
  });

  it('should render nesting depth control', () => {
    render(<TreemapControls {...defaultProps} />);
    expect(screen.getByText('Depth')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should call onColorModeChange when selecting different option', () => {
    const onColorModeChange = vi.fn();
    render(<TreemapControls {...defaultProps} onColorModeChange={onColorModeChange} />);
    const colorSelect = screen.getByDisplayValue('Language');
    fireEvent.change(colorSelect, { target: { value: 'age' } });
    expect(onColorModeChange).toHaveBeenCalledWith('age');
  });

  it('should call onSizeModeChange when selecting different option', () => {
    const onSizeModeChange = vi.fn();
    render(<TreemapControls {...defaultProps} onSizeModeChange={onSizeModeChange} />);
    const sizeSelect = screen.getByDisplayValue('LOC');
    fireEvent.change(sizeSelect, { target: { value: 'files' } });
    expect(onSizeModeChange).toHaveBeenCalledWith('files');
  });

  it('should call onNestingDepthChange when clicking plus', () => {
    const onNestingDepthChange = vi.fn();
    render(<TreemapControls {...defaultProps} onNestingDepthChange={onNestingDepthChange} />);
    fireEvent.click(screen.getByText('+'));
    expect(onNestingDepthChange).toHaveBeenCalledWith(4);
  });

  it('should call onNestingDepthChange when clicking minus', () => {
    const onNestingDepthChange = vi.fn();
    render(<TreemapControls {...defaultProps} onNestingDepthChange={onNestingDepthChange} />);
    fireEvent.click(screen.getByText('−'));
    expect(onNestingDepthChange).toHaveBeenCalledWith(2);
  });

  it('should not allow depth below 1', () => {
    const onNestingDepthChange = vi.fn();
    render(<TreemapControls {...defaultProps} nestingDepth={1} onNestingDepthChange={onNestingDepthChange} />);
    fireEvent.click(screen.getByText('−'));
    expect(onNestingDepthChange).not.toHaveBeenCalled();
  });

  it('should not allow depth above maxDepth', () => {
    const onNestingDepthChange = vi.fn();
    render(<TreemapControls {...defaultProps} nestingDepth={10} maxDepth={10} onNestingDepthChange={onNestingDepthChange} />);
    fireEvent.click(screen.getByText('+'));
    expect(onNestingDepthChange).not.toHaveBeenCalled();
  });

  it('should show current color mode as selected', () => {
    render(<TreemapControls {...defaultProps} colorMode="complexity" />);
    const colorSelect = screen.getByDisplayValue('Complexity');
    expect(colorSelect).toBeInTheDocument();
  });

  it('should show current size mode as selected', () => {
    render(<TreemapControls {...defaultProps} sizeMode="files" />);
    const sizeSelect = screen.getByDisplayValue('Files');
    expect(sizeSelect).toBeInTheDocument();
  });

  it('should disable minus button at minimum depth', () => {
    render(<TreemapControls {...defaultProps} nestingDepth={1} />);
    const minusButton = screen.getByText('−');
    expect(minusButton).toBeDisabled();
  });

  it('should disable plus button at maximum depth', () => {
    render(<TreemapControls {...defaultProps} nestingDepth={10} maxDepth={10} />);
    const plusButton = screen.getByText('+');
    expect(plusButton).toBeDisabled();
  });
});
