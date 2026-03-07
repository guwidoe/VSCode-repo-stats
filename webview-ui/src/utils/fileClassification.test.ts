import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GENERATED_PATTERNS,
  getFileExtension,
  globToRegex,
  isGeneratedFile,
} from './fileClassification';

describe('fileClassification', () => {
  it('extracts normalized extensions', () => {
    expect(getFileExtension('App.TS')).toBe('.ts');
    expect(getFileExtension('README')).toBe('(no ext)');
    expect(getFileExtension('.env')).toBe('(no ext)');
  });

  it('matches generated files using glob patterns', () => {
    expect(isGeneratedFile('src/generated/types.ts', DEFAULT_GENERATED_PATTERNS)).toBe(true);
    expect(isGeneratedFile('dist/app.min.js', DEFAULT_GENERATED_PATTERNS)).toBe(true);
    expect(isGeneratedFile('src/app.ts', DEFAULT_GENERATED_PATTERNS)).toBe(false);
  });

  it('matches generated patterns at the repository root', () => {
    expect(isGeneratedFile('generated/types.ts', DEFAULT_GENERATED_PATTERNS)).toBe(true);
    expect(isGeneratedFile('dist/app.js', DEFAULT_GENERATED_PATTERNS)).toBe(true);
    expect(isGeneratedFile('app.min.js', DEFAULT_GENERATED_PATTERNS)).toBe(true);
    expect(isGeneratedFile('package-lock.json', DEFAULT_GENERATED_PATTERNS)).toBe(true);
  });

  it('converts globs into regex with path-awareness', () => {
    const regex = globToRegex('**/*.generated.*');
    expect(regex.test('foo/bar/file.generated.ts')).toBe(true);
    expect(regex.test('foo/bar/file.ts')).toBe(false);
  });
});
