const GLOB_CHARS = /[*?[]/;

function normalizeValue(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function hasGlobChars(value: string): boolean {
  return GLOB_CHARS.test(value);
}

function toDirectoryPattern(pattern: string): string {
  return `**/${pattern}/**`;
}

function normalizePattern(pattern: string): string | null {
  const normalized = normalizeValue(pattern);
  if (!normalized) {
    return null;
  }

  if (!hasGlobChars(normalized)) {
    return toDirectoryPattern(normalized);
  }

  return normalized;
}

function splitSegments(value: string): string[] {
  if (!value) {
    return [];
  }

  return value.split('/').filter((segment) => segment.length > 0);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchSegment(segment: string, patternSegment: string): boolean {
  if (patternSegment === '**') {
    return true;
  }

  const regex = new RegExp(
    `^${Array.from(patternSegment)
      .map((char) => {
        if (char === '*') {
          return '[^/]*';
        }
        if (char === '?') {
          return '[^/]';
        }
        return escapeRegExp(char);
      })
      .join('')}$`
  );

  return regex.test(segment);
}

function matchSegments(
  pathSegments: string[],
  patternSegments: string[],
  pathIndex: number,
  patternIndex: number,
  memo: Map<string, boolean>
): boolean {
  const key = `${pathIndex}:${patternIndex}`;
  const cached = memo.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let result = false;

  if (patternIndex >= patternSegments.length) {
    result = pathIndex >= pathSegments.length;
  } else {
    const currentPattern = patternSegments[patternIndex];

    if (currentPattern === '**') {
      result =
        matchSegments(pathSegments, patternSegments, pathIndex, patternIndex + 1, memo) ||
        (pathIndex < pathSegments.length &&
          matchSegments(pathSegments, patternSegments, pathIndex + 1, patternIndex, memo));
    } else if (
      pathIndex < pathSegments.length &&
      matchSegment(pathSegments[pathIndex], currentPattern)
    ) {
      result = matchSegments(
        pathSegments,
        patternSegments,
        pathIndex + 1,
        patternIndex + 1,
        memo
      );
    }
  }

  memo.set(key, result);
  return result;
}

export function matchesPathPattern(filePath: string, pattern: string): boolean {
  const normalizedPattern = normalizePattern(pattern);
  if (!normalizedPattern) {
    return false;
  }

  const normalizedPath = normalizeValue(filePath);
  if (!normalizedPath) {
    return false;
  }

  return matchSegments(
    splitSegments(normalizedPath),
    splitSegments(normalizedPattern),
    0,
    0,
    new Map<string, boolean>()
  );
}

export function createPathPatternMatcher(patterns: string[]): (filePath: string) => boolean {
  const normalizedPatterns = patterns
    .map((pattern) => normalizePattern(pattern))
    .filter((pattern): pattern is string => pattern !== null);

  if (normalizedPatterns.length === 0) {
    return () => false;
  }

  return (filePath: string) => normalizedPatterns.some((pattern) => matchesPathPattern(filePath, pattern));
}

export function getLiteralExcludeDirNames(patterns: string[]): string[] {
  const dirNames = new Set<string>();

  for (const pattern of patterns) {
    const normalized = normalizeValue(pattern);
    if (!normalized || hasGlobChars(normalized) || normalized.includes('/')) {
      continue;
    }

    dirNames.add(normalized);
  }

  return Array.from(dirNames);
}
