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
 * Checks if a file should be considered binary based on its path.
 */
export function isBinaryFile(filePath: string): boolean {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) {
    return false;
  }
  const ext = filePath.substring(lastDot).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
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
