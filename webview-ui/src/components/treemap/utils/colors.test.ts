import { describe, it, expect } from 'vitest';
import {
  adjustBrightness,
  getContrastColor,
  parseColor,
  colorToRgba,
} from './colors';

describe('adjustBrightness', () => {
  it('should brighten a color with factor > 1', () => {
    const result = adjustBrightness('#808080', 1.5);
    // Gray 128 * 1.5 = 192
    expect(result).toBe('rgb(192, 192, 192)');
  });

  it('should darken a color with factor < 1', () => {
    const result = adjustBrightness('#ffffff', 0.5);
    expect(result).toBe('rgb(128, 128, 128)');
  });

  it('should clamp values to 0-255', () => {
    const result = adjustBrightness('#ffffff', 2);
    expect(result).toBe('rgb(255, 255, 255)');
  });
});

describe('getContrastColor', () => {
  it('should return white for dark backgrounds', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
    expect(getContrastColor('#333333')).toBe('#ffffff');
  });

  it('should return dark color for light backgrounds', () => {
    expect(getContrastColor('#ffffff')).toBe('#1e1e1e');
    expect(getContrastColor('#f0f0f0')).toBe('#1e1e1e');
  });
});

describe('parseColor', () => {
  it('should parse hex colors', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('should parse short hex colors', () => {
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should parse rgb colors', () => {
    expect(parseColor('rgb(255, 128, 64)')).toEqual({ r: 255, g: 128, b: 64 });
  });
});

describe('colorToRgba', () => {
  it('should convert RGB to rgb string without alpha', () => {
    expect(colorToRgba({ r: 255, g: 128, b: 64 })).toBe('rgb(255, 128, 64)');
  });

  it('should convert RGB to rgba string with alpha', () => {
    expect(colorToRgba({ r: 255, g: 128, b: 64 }, 0.5)).toBe(
      'rgba(255, 128, 64, 0.5)'
    );
  });
});
