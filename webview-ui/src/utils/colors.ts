/**
 * Color utilities for the Repo Stats webview.
 */

// ============================================================================
// Language Colors (GitHub Linguist-style)
// ============================================================================

export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Ruby: '#701516',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  PHP: '#4F5D95',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Sass: '#a53b70',
  Less: '#1d365d',
  JSON: '#292929',
  YAML: '#cb171e',
  XML: '#0060ac',
  Markdown: '#083fa1',
  MDX: '#1B1F24',
  Shell: '#89e051',
  SQL: '#e38c00',
  GraphQL: '#e10098',
  Dockerfile: '#384d54',
  Terraform: '#5c4ee5',
  HCL: '#844FBA',
  Lua: '#000080',
  R: '#198CE7',
  Scala: '#c22d40',
  Clojure: '#db5855',
  Elixir: '#6e4a7e',
  Erlang: '#B83998',
  Haskell: '#5e5086',
  OCaml: '#3be133',
  'F#': '#b845fc',
  Perl: '#0298c3',
  Dart: '#00B4AB',
  Zig: '#ec915c',
  Nim: '#ffc200',
  V: '#4f87c4',
  Solidity: '#AA6746',
  TOML: '#9c4221',
  'Go Module': '#00ADD8',
  Makefile: '#427819',
  CMake: '#DA3434',
  Unknown: '#8b8b8b',
};

export function getLanguageColor(language: string): string {
  return LANGUAGE_COLORS[language] || LANGUAGE_COLORS.Unknown;
}

// ============================================================================
// Age-based Colors (Heat Map)
// ============================================================================

export function getAgeColor(lastModified: string | undefined): string {
  if (!lastModified) {return '#8b8b8b';}

  const now = new Date();
  const modified = new Date(lastModified);
  const diffMs = now.getTime() - modified.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 30) {
    // Green - recently modified (< 1 month)
    return '#4caf50';
  } else if (diffDays < 90) {
    // Light green - 1-3 months
    return '#8bc34a';
  } else if (diffDays < 180) {
    // Yellow - 3-6 months
    return '#ffeb3b';
  } else if (diffDays < 365) {
    // Orange - 6-12 months
    return '#ff9800';
  } else {
    // Red - older than 1 year
    return '#f44336';
  }
}

// ============================================================================
// Contributor Avatar Colors
// ============================================================================

const AVATAR_COLORS = [
  '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
  '#2196f3', '#03a9f4', '#00bcd4', '#009688',
  '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
  '#ffc107', '#ff9800', '#ff5722', '#795548',
];

export function getAvatarColor(email: string): string {
  // Simple hash of email to get consistent color
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {return '?';}
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {return parts[0].charAt(0).toUpperCase();}
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ============================================================================
// Format Utilities
// ============================================================================

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) {return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;}
  if (diffMonths > 0) {return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;}
  if (diffDays > 0) {return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;}
  if (diffHours > 0) {return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;}
  if (diffMinutes > 0) {return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;}
  return 'just now';
}
