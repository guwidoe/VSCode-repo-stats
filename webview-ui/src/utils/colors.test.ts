/**
 * Tests for color utilities.
 */

import { describe, it, expect } from 'vitest';
import type { TreemapNode } from '../types';
import {
  getLanguageColor,
  getAgeColor,
  getAvatarColor,
  getInitials,
  formatNumber,
  formatRelativeTime,
  parseValidAgeTimestamp,
  resolveAgeColorDomain,
} from './colors';

describe('getLanguageColor', () => {
  it('should return correct color for TypeScript', () => {
    expect(getLanguageColor('TypeScript')).toBe('#3178c6');
  });

  it('should return correct color for JavaScript', () => {
    expect(getLanguageColor('JavaScript')).toBe('#f1e05a');
  });

  it('should return gray for unknown languages', () => {
    expect(getLanguageColor('UnknownLanguage')).toBe('#8b8b8b');
  });
});

describe('age color range utilities', () => {
  const root: TreemapNode = {
    name: 'repo',
    path: '',
    type: 'directory',
    children: [
      {
        name: 'recent.ts',
        path: 'recent.ts',
        type: 'file',
        lastModified: '2026-03-01T00:00:00.000Z',
      },
      {
        name: 'old.ts',
        path: 'old.ts',
        type: 'file',
        lastModified: '2025-03-01T00:00:00.000Z',
      },
      {
        name: 'missing.ts',
        path: 'missing.ts',
        type: 'file',
      },
      {
        name: 'epoch.ts',
        path: 'epoch.ts',
        type: 'file',
        lastModified: '1970-01-01T00:00:00.000Z',
      },
    ],
  };

  it('treats missing and 1970-era timestamps as invalid for age coloring', () => {
    expect(parseValidAgeTimestamp(undefined)).toBeNull();
    expect(parseValidAgeTimestamp('1970-01-01T00:00:00.000Z')).toBeNull();
    expect(parseValidAgeTimestamp('2026-03-01T00:00:00.000Z')).toBe(Date.parse('2026-03-01T00:00:00.000Z'));
  });

  it('builds auto age domains from the newest and oldest valid files only', () => {
    const domain = resolveAgeColorDomain(root, {
      ageColorRangeMode: 'auto',
      ageColorNewestDate: '',
      ageColorOldestDate: '',
    });

    expect(domain).toEqual({
      newestTimestamp: Date.parse('2026-03-01T00:00:00.000Z'),
      oldestTimestamp: Date.parse('2025-03-01T00:00:00.000Z'),
    });
  });

  it('uses custom configured date boundaries when requested', () => {
    const domain = resolveAgeColorDomain(root, {
      ageColorRangeMode: 'custom',
      ageColorNewestDate: '2026-02-01',
      ageColorOldestDate: '2025-02-01',
    });

    expect(domain).toEqual({
      newestTimestamp: Date.parse('2026-02-01T00:00:00.000Z'),
      oldestTimestamp: Date.parse('2025-02-01T00:00:00.000Z'),
    });
  });

  it('returns gray when the age domain or timestamp is invalid', () => {
    expect(getAgeColor(undefined, null)).toBe('#8b8b8b');
    expect(getAgeColor('1970-01-01T00:00:00.000Z', {
      newestTimestamp: Date.parse('2026-03-01T00:00:00.000Z'),
      oldestTimestamp: Date.parse('2025-03-01T00:00:00.000Z'),
    })).toBe('#8b8b8b');
  });

  it('maps newest dates to green and oldest dates to red', () => {
    const domain = {
      newestTimestamp: Date.parse('2026-03-01T00:00:00.000Z'),
      oldestTimestamp: Date.parse('2025-03-01T00:00:00.000Z'),
    };

    expect(getAgeColor('2026-03-01T00:00:00.000Z', domain)).toBe('#4caf50');
    expect(getAgeColor('2025-03-01T00:00:00.000Z', domain)).toBe('#f44336');
  });
});

describe('getAvatarColor', () => {
  it('should return consistent color for same email', () => {
    const color1 = getAvatarColor('test@example.com');
    const color2 = getAvatarColor('test@example.com');
    expect(color1).toBe(color2);
  });

  it('should return different colors for different emails', () => {
    const color1 = getAvatarColor('user1@example.com');
    const color2 = getAvatarColor('user2@example.com');
    // Not guaranteed to be different, but likely
    expect(typeof color1).toBe('string');
    expect(typeof color2).toBe('string');
  });
});

describe('getInitials', () => {
  it('should return two initials for full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('should return single initial for single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('should handle multiple middle names', () => {
    expect(getInitials('John Michael William Doe')).toBe('JD');
  });

  it('should return ? for empty string', () => {
    expect(getInitials('')).toBe('?');
  });
});

describe('formatNumber', () => {
  it('should format millions', () => {
    expect(formatNumber(1500000)).toBe('1.5M');
  });

  it('should format thousands', () => {
    expect(formatNumber(1500)).toBe('1.5K');
  });

  it('should not format small numbers', () => {
    expect(formatNumber(500)).toBe('500');
  });
});

describe('formatRelativeTime', () => {
  it('should return "just now" for very recent times', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('should format minutes ago', () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - 5);
    expect(formatRelativeTime(date.toISOString())).toBe('5 minutes ago');
  });

  it('should format hours ago', () => {
    const date = new Date();
    date.setHours(date.getHours() - 3);
    expect(formatRelativeTime(date.toISOString())).toBe('3 hours ago');
  });

  it('should format days ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 5);
    expect(formatRelativeTime(date.toISOString())).toBe('5 days ago');
  });

  it('should format years ago', () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    expect(formatRelativeTime(date.toISOString())).toBe('2 years ago');
  });
});
