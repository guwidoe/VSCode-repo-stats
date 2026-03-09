const GLOB_CHARS = /[*?[]/;

interface ParsedPattern {
  normalized: string;
  hasGlob: boolean;
  anchored: boolean;
}

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

function parsePattern(pattern: string): ParsedPattern | null {
  const trimmed = pattern.trim().replace(/\\/g, '/');
  if (!trimmed) {
    return null;
  }

  const anchored = trimmed.startsWith('./') || trimmed.startsWith('/');
  const normalized = normalizeValue(trimmed);
  if (!normalized) {
    return null;
  }

  return {
    normalized,
    hasGlob: hasGlobChars(normalized),
    anchored,
  };
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

function matchesPlainPath(filePath: string, pattern: string, anchored: boolean): boolean {
  if (anchored || pattern.includes('/') || pattern.includes('.')) {
    return filePath === pattern || filePath.startsWith(`${pattern}/`);
  }

  return splitSegments(filePath).includes(pattern);
}

function matchesParsedPattern(normalizedPath: string, pattern: ParsedPattern): boolean {
  if (!pattern.hasGlob) {
    return matchesPlainPath(normalizedPath, pattern.normalized, pattern.anchored);
  }

  return matchSegments(
    splitSegments(normalizedPath),
    splitSegments(pattern.normalized),
    0,
    0,
    new Map<string, boolean>()
  );
}

export function matchesPathPattern(filePath: string, pattern: string): boolean {
  const parsedPattern = parsePattern(pattern);
  if (!parsedPattern) {
    return false;
  }

  const normalizedPath = normalizeValue(filePath);
  if (!normalizedPath) {
    return false;
  }

  return matchesParsedPattern(normalizedPath, parsedPattern);
}

export function createPathPatternMatcher(patterns: string[]): (filePath: string) => boolean {
  const parsedPatterns = patterns
    .map((pattern) => parsePattern(pattern))
    .filter((pattern): pattern is ParsedPattern => pattern !== null);

  if (parsedPatterns.length === 0) {
    return () => false;
  }

  return (filePath: string) => {
    const normalizedPath = normalizeValue(filePath);
    if (!normalizedPath) {
      return false;
    }

    return parsedPatterns.some((pattern) => matchesParsedPattern(normalizedPath, pattern));
  };
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
