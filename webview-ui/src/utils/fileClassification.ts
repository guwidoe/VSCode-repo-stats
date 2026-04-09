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

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return '(no ext)';
  }
  return filename.slice(lastDot).toLowerCase();
}

export function globToRegex(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
  const doubleStarSlash = '__DOUBLE_STAR_SLASH__';
  const slashDoubleStar = '__SLASH_DOUBLE_STAR__';
  const doubleStar = '__DOUBLE_STAR__';

  const regex = normalized
    .replace(/\*\*\//g, doubleStarSlash)
    .replace(/\/\*\*/g, slashDoubleStar)
    .replace(/\*\*/g, doubleStar)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(new RegExp(doubleStarSlash, 'g'), '(?:.*/)?')
    .replace(new RegExp(slashDoubleStar, 'g'), '(?:/.*)?')
    .replace(new RegExp(doubleStar, 'g'), '.*');

  return new RegExp(`^${regex}$`, 'i');
}

export function isGeneratedFile(path: string, patterns: string[]): boolean {
  const normalizedPath = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  return patterns.some((pattern) => globToRegex(pattern).test(normalizedPath));
}
