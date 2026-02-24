/**
 * File type classification for treemap filtering.
 */

// Binary file extensions - files that are not human-readable source code
// Note: SVG is excluded because it's text-based XML that scc can process
export const BINARY_EXTENSIONS = new Set([
  // Images - common formats (excluding SVG which is text/XML)
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff', '.tif',
  // Images - professional/raw
  '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.heic', '.avif', '.arw', '.dng', '.raf',
  // Videos
  '.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.mpeg', '.mpg',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus',
  // Fonts
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  // Archives
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.tgz',
  // Compiled/Binary
  '.pyc', '.pyo', '.class', '.o', '.so', '.dll', '.exe', '.bin',
  '.wasm', '.a', '.lib', '.obj',
  // Documents (non-text)
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Database
  '.sqlite', '.db', '.mdb',
  // Disk images / VMs
  '.vhdx', '.vmdk', '.iso', '.dmg', '.deb', '.rpm',
  // Other binary
  '.icns',
]);

// Non-code file types (config, data, documentation)
// These are text-based but not "code" in the traditional sense
export const NON_CODE_LANGUAGES = new Set([
  'JSON',
  'YAML',
  'XML',
  'TOML',
  'Markdown',
  'MDX',
  'Plain Text',
  'reStructuredText',
  'AsciiDoc',
  'Unknown',
]);

// Code languages (programming languages)
export const CODE_LANGUAGES = new Set([
  'TypeScript', 'JavaScript', 'Python', 'Ruby', 'Go', 'Rust',
  'Java', 'Kotlin', 'Swift', 'C', 'C++', 'C#', 'PHP',
  'Vue', 'Svelte', 'HTML', 'CSS', 'SCSS', 'Sass', 'Less',
  'Shell', 'SQL', 'GraphQL', 'Dockerfile', 'Terraform', 'HCL',
  'Lua', 'R', 'Scala', 'Clojure', 'Elixir', 'Erlang',
  'Haskell', 'OCaml', 'F#', 'Perl', 'Dart', 'Zig', 'Nim', 'V',
  'Solidity', 'Makefile', 'CMake', 'Go Module',
]);

/**
 * Normalizes extension input into lowercase ".ext" format.
 * Returns null for invalid values.
 */
export function normalizeExtension(extension: string): string | null {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const normalizedPath = trimmed.replace(/\\/g, '/');
  const extFromPath = normalizedPath.includes('.')
    ? normalizedPath.slice(normalizedPath.lastIndexOf('.'))
    : '';

  const candidate = extFromPath
    ? extFromPath
    : normalizedPath.startsWith('.')
      ? normalizedPath
      : `.${normalizedPath}`;

  if (
    candidate === '.' ||
    candidate.includes('/') ||
    candidate.includes('*') ||
    candidate.includes('?')
  ) {
    return null;
  }

  return candidate;
}

/**
 * Builds a normalized binary-extension set from settings.
 * - If undefined: uses default built-in binary extensions.
 * - If provided (including empty array): uses exactly the provided values.
 */
export function buildBinaryExtensionSet(extensions?: string[]): Set<string> {
  if (extensions === undefined) {
    return new Set(BINARY_EXTENSIONS);
  }

  const result = new Set<string>();
  for (const extension of extensions) {
    const normalized = normalizeExtension(extension);
    if (normalized) {
      result.add(normalized);
    }
  }

  return result;
}

/**
 * Checks if a file should be considered binary based on its path.
 */
export function isBinaryFile(
  filePath: string,
  binaryExtensions: Set<string> = BINARY_EXTENSIONS
): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop() || '';

  if (!fileName) {
    return false;
  }

  let extension = '';
  const lastDot = fileName.lastIndexOf('.');

  if (lastDot > 0) {
    extension = fileName.slice(lastDot).toLowerCase();
  } else if (lastDot === 0 && fileName.indexOf('.', 1) === -1) {
    // Dotfile like .env
    extension = fileName.toLowerCase();
  }

  return extension.length > 0 && binaryExtensions.has(extension);
}

/**
 * Checks if a language is considered "code" vs config/data/docs.
 */
export function isCodeLanguage(language: string | undefined): boolean {
  if (!language) {
    return false;
  }
  return CODE_LANGUAGES.has(language);
}
