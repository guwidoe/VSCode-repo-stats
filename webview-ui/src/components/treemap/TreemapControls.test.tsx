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

  it('should call onSizeModeChange when toggling', () => {
    const onSizeModeChange = vi.fn()
    render(<TreemapControls {...defaultProps} onSizeModeChange={onSizeModeChange} />)
    fireEvent.click(screen.getByText('Files'))
    expect(onSizeModeChange).toHaveBeenCalledWith('files')
  })

  it('should call onNestingDepthChange when clicking plus', () => {
    const onNestingDepthChange = vi.fn()
    render(<TreemapControls {...defaultProps} onNestingDepthChange={onNestingDepthChange} />)
    fireEvent.click(screen.getByText('+'))
    expect(onNestingDepthChange).toHaveBeenCalledWith(4)
  })

  it('should call onNestingDepthChange when clicking minus', () => {
    const onNestingDepthChange = vi.fn()
    render(<TreemapControls {...defaultProps} onNestingDepthChange={onNestingDepthChange} />)
    fireEvent.click(screen.getByText('−'))
    expect(onNestingDepthChange).toHaveBeenCalledWith(2)
  })

  it('should not allow depth below 1', () => {
    const onNestingDepthChange = vi.fn()
    render(<TreemapControls {...defaultProps} nestingDepth={1} onNestingDepthChange={onNestingDepthChange} />)
    fireEvent.click(screen.getByText('−'))
    expect(onNestingDepthChange).not.toHaveBeenCalled()
  })

  it('should not allow depth above 10', () => {
    const onNestingDepthChange = vi.fn()
    render(<TreemapControls {...defaultProps} nestingDepth={10} onNestingDepthChange={onNestingDepthChange} />)
    fireEvent.click(screen.getByText('+'))
    expect(onNestingDepthChange).not.toHaveBeenCalled()
  })

  it('should show active state for current color mode', () => {
    const { container } = render(<TreemapControls {...defaultProps} colorMode="language" />)
    const languageButton = container.querySelector('.toggle-button.active')
    expect(languageButton).toHaveTextContent('By Language')
  })

  it('should show active state for current size mode', () => {
    const { container } = render(<TreemapControls {...defaultProps} sizeMode="files" />)
    const activeButtons = container.querySelectorAll('.toggle-button.active')
    const filesButton = Array.from(activeButtons).find(btn => btn.textContent === 'Files')
    expect(filesButton).toBeTruthy()
  })

  it('should disable minus button at minimum depth', () => {
    render(<TreemapControls {...defaultProps} nestingDepth={1} />)
    const minusButton = screen.getByText('−')
    expect(minusButton).toBeDisabled()
  })

  it('should disable plus button at maximum depth', () => {
    render(<TreemapControls {...defaultProps} nestingDepth={10} />)
    const plusButton = screen.getByText('+')
    expect(plusButton).toBeDisabled()
  })
})
