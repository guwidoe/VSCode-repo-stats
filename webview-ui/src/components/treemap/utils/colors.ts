export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse a color string to RGB values
 */
export function parseColor(color: string): RGB {
  // Handle hex colors
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  // Handle rgb() colors
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    };
  }

  // Default fallback
  return { r: 128, g: 128, b: 128 };
}

/**
 * Convert RGB to CSS color string
 */
export function colorToRgba(rgb: RGB, alpha = 1): string {
  if (alpha === 1) {
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Adjust brightness of a color by a factor
 * factor > 1 brightens, factor < 1 darkens
 */
export function adjustBrightness(color: string, factor: number): string {
  const rgb = parseColor(color);
  return colorToRgba({
    r: Math.min(255, Math.max(0, Math.round(rgb.r * factor))),
    g: Math.min(255, Math.max(0, Math.round(rgb.g * factor))),
    b: Math.min(255, Math.max(0, Math.round(rgb.b * factor))),
  });
}

/**
 * Get a contrasting text color (white or dark) for a background
 */
export function getContrastColor(backgroundColor: string): string {
  const rgb = parseColor(backgroundColor);
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#1e1e1e' : '#ffffff';
}

/**
 * Standard directory color (neutral gray)
 */
export const DIRECTORY_COLOR = '#4a4a4a';

/**
 * Hover highlight color (semi-transparent white overlay)
 */
export const HOVER_OVERLAY_COLOR = 'rgba(255, 255, 255, 0.2)';

/**
 * Selection border color
 */
export const SELECTION_BORDER_COLOR = '#007acc';

/**
 * Hover border color
 */
export const HOVER_BORDER_COLOR = '#ffffff';
