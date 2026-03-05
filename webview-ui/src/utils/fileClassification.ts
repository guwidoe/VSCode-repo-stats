/**
 * Shared file classification helpers (extensions + generated-file detection).
 */

// Built-in generated-file patterns (kept in sync with package.json defaults).
export const DEFAULT_GENERATED_PATTERNS = [
  '**/generated/**',
  '**/gen/**',
  '**/__generated__/**',
  '**/dist/**',
  '**/build/**',
  '**/*.generated.*',
  '**/*.g.ts',
  '**/*.g.js',
  '**/*.g.dart',
  '**/*.min.js',
  '**/*.min.css',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/*-lock.*',
];

/**
 * Returns a normalized file extension for display/filtering.
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return '(no ext)';
  }
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Convert a glob pattern to a regex pattern.
 * Supports: ** (any path), * (any chars except /), ? (single char)
 */
export function globToRegex(glob: string): RegExp {
  let regex = glob
    // Escape special regex chars except * and ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // Convert ** to match any path segment
    .replace(/\*\*/g, '.*')
    // Convert * to match anything except /
    .replace(/\*/g, '[^/]*')
    // Convert ? to match single char
    .replace(/\?/g, '.');

  // If pattern doesn't start with **, match from start or after /
  if (!glob.startsWith('**')) {
    regex = '(^|/)' + regex;
  }

  // If pattern doesn't end with **, match to end or before /
  if (!glob.endsWith('**')) {
    regex = regex + '($|/)';
  }

  return new RegExp(regex, 'i');
}

/**
 * Check if a path matches any of the generated-file patterns.
 */
export function isGeneratedFile(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegex(pattern).test(path));
}
