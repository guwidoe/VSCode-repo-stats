/**
 * Tests for LOC extension filtering helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeExtensionForFilter,
  shouldExcludeFileByExtension,
} from './locCounter';

describe('normalizeExtensionForFilter', () => {
  it('normalizes extension values to lowercase dot-prefixed format', () => {
    expect(normalizeExtensionForFilter('.svg')).toBe('.svg');
    expect(normalizeExtensionForFilter('svg')).toBe('.svg');
    expect(normalizeExtensionForFilter('  .SVG  ')).toBe('.svg');
    expect(normalizeExtensionForFilter('TSX')).toBe('.tsx');
  });

  it('accepts common glob-like forms used by users', () => {
    expect(normalizeExtensionForFilter('*.svg')).toBe('.svg');
    expect(normalizeExtensionForFilter('**/*.svg')).toBe('.svg');
    expect(normalizeExtensionForFilter('assets/*.svg')).toBe('.svg');
  });

  it('returns null for invalid extension values', () => {
    expect(normalizeExtensionForFilter('')).toBeNull();
    expect(normalizeExtensionForFilter('   ')).toBeNull();
    expect(normalizeExtensionForFilter('.')).toBeNull();
    expect(normalizeExtensionForFilter('folder/svg')).toBeNull();
    expect(normalizeExtensionForFilter('assets/icons')).toBeNull();
    expect(normalizeExtensionForFilter('*')).toBeNull();
  });
});

describe('shouldExcludeFileByExtension', () => {
  it('matches excluded extensions case-insensitively', () => {
    const excluded = new Set(['.svg', '.png']);

    expect(shouldExcludeFileByExtension('icons/logo.svg', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('icons/LOGO.SVG', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('icons\\logo.SVG', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('icons/logo.jpg', excluded)).toBe(false);
  });

  it('supports dotfile names when configured explicitly', () => {
    const excluded = new Set(['.env']);

    expect(shouldExcludeFileByExtension('.env', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('config/.ENV', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('config/.env.local', excluded)).toBe(false);
  });

  it('returns false when exclusion set is empty', () => {
    expect(shouldExcludeFileByExtension('icons/logo.svg', new Set())).toBe(false);
  });
});
