/**
 * Language color palette (GitHub linguist-style)
 */
export const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C Header': '#555555',
  'C++ Header': '#f34b7d',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  HTML: '#e34c26',
  JSON: '#292929',
  Markdown: '#083fa1',
  YAML: '#cb171e',
  XML: '#0060ac',
  Shell: '#89e051',
  SQL: '#e38c00',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};

/**
 * Get color for a programming language
 * Returns a default gray if language is not recognized
 */
export function getLanguageColor(language?: string): string {
  if (!language) {
    return '#808080';
  }
  return languageColors[language] || '#808080';
}

/**
 * Get color for file age
 * Green = recent, Yellow = medium, Red = old
 */
export function getAgeColor(lastModified?: Date): string {
  if (!lastModified) {
    return '#808080';
  }

  const now = new Date();
  const diffMs = now.getTime() - lastModified.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 30) {
    // Less than 1 month - green
    return '#28a745';
  } else if (diffDays < 180) {
    // 1-6 months - yellow to orange gradient
    const ratio = (diffDays - 30) / 150;
    return interpolateColor('#ffc107', '#fd7e14', ratio);
  } else {
    // More than 6 months - red
    return '#dc3545';
  }
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
