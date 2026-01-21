/**
 * Hook for computing overview statistics from the file tree.
 */

import { useMemo } from 'react';
import { useStore } from '../store';
import type { TreemapNode } from '../types';
import { isBinaryFile, isCodeLanguage } from '../utils/fileTypes';
import { getLanguageColor } from '../utils/colors';

export interface ExtensionStats {
  ext: string;
  count: number;
}

export interface LanguageStats {
  language: string;
  lines: number;
  color: string;
  fileCount: number;
}

export interface LargestFile {
  path: string;
  name: string;
  lines: number;
  language: string;
}

export interface BinaryStats {
  category: string;
  count: number;
  extensions: string[];
}

export interface OverviewStats {
  files: {
    total: number;
    codeFiles: number;
    generatedFiles: number;
    byExtension: ExtensionStats[];
  };
  loc: {
    total: number;
    codeOnly: number;
    excludingGenerated: number;
    byLanguage: LanguageStats[];
  };
  languages: {
    count: number;
    codeLanguages: number;
  };
  largestFiles: LargestFile[];
  unknownExtensions: ExtensionStats[];
  binary: {
    total: number;
    byCategory: BinaryStats[];
  };
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return '(no ext)';
  }
  return filename.slice(lastDot).toLowerCase();
}

// Patterns that indicate generated files
const GENERATED_PATTERNS = [
  /\/generated\//i,
  /\/gen\//i,
  /\/__generated__\//i,
  /\/dist\//i,
  /\/build\//i,
  /\.generated\./i,
  /\.g\.(dart|ts|js)$/i,
  /\.gen\.(ts|js)$/i,
  /\.pb\.(go|ts|js)$/i,  // protobuf
  /\.graphql\.(ts|js)$/i,
  /_generated\./i,
  /\.min\.(js|css)$/i,
  /\.bundle\.(js|css)$/i,
  /lock\.json$/i,
  /lock\.yaml$/i,
  /-lock\./i,
];

function isGeneratedFile(path: string): boolean {
  return GENERATED_PATTERNS.some(pattern => pattern.test(path));
}

// Binary file categories
const BINARY_CATEGORIES: Record<string, string[]> = {
  'Images': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.avif'],
  'Raw Photos': ['.raw', '.cr2', '.nef', '.arw', '.dng', '.raf', '.rw2'],
  'Videos': ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'],
  'Audio': ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'],
  'Fonts': ['.ttf', '.otf', '.woff', '.woff2', '.eot'],
  'Archives': ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.tgz'],
  'Documents': ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
  'Compiled': ['.pyc', '.class', '.o', '.so', '.dll', '.exe', '.wasm', '.bin'],
};

function getBinaryCategory(ext: string): string | null {
  for (const [category, extensions] of Object.entries(BINARY_CATEGORIES)) {
    if (extensions.includes(ext.toLowerCase())) {
      return category;
    }
  }
  return null;
}

interface TraversalState {
  extensionMap: Map<string, number>;
  languageMap: Map<string, { lines: number; fileCount: number }>;
  unknownExtMap: Map<string, number>;
  binaryCategoryMap: Map<string, Set<string>>;
  allCodeFiles: LargestFile[];
  codeFileCount: number;
  generatedFileCount: number;
  generatedLines: number;
  binaryFileCount: number;
}

function traverseTree(node: TreemapNode, state: TraversalState): void {
  if (node.type === 'file') {
    const ext = getFileExtension(node.name);
    const isBinary = isBinaryFile(node.path);
    const isGenerated = isGeneratedFile(node.path);

    // Count by extension (all files)
    state.extensionMap.set(ext, (state.extensionMap.get(ext) || 0) + 1);

    if (isBinary) {
      state.binaryFileCount++;
      // Track binary by category
      const category = getBinaryCategory(ext);
      if (category) {
        if (!state.binaryCategoryMap.has(category)) {
          state.binaryCategoryMap.set(category, new Set());
        }
        state.binaryCategoryMap.get(category)!.add(ext);
      }
    } else {
      // Non-binary file
      const language = node.language || 'Unknown';
      const lines = node.lines || 0;

      // Track LOC by language
      const existing = state.languageMap.get(language) || { lines: 0, fileCount: 0 };
      state.languageMap.set(language, {
        lines: existing.lines + lines,
        fileCount: existing.fileCount + 1,
      });

      // Track unknown extensions
      if (language === 'Unknown') {
        state.unknownExtMap.set(ext, (state.unknownExtMap.get(ext) || 0) + 1);
      }

      // Track generated files
      if (isGenerated) {
        state.generatedFileCount++;
        state.generatedLines += lines;
      }

      // Track code files for largest files list
      if (isCodeLanguage(language) && !isGenerated) {
        state.codeFileCount++;
        state.allCodeFiles.push({
          path: node.path,
          name: node.name,
          lines,
          language,
        });
      }
    }
  } else if (node.children) {
    for (const child of node.children) {
      traverseTree(child, state);
    }
  }
}

export function useOverviewStats(): OverviewStats | null {
  const data = useStore((state) => state.data);

  return useMemo(() => {
    if (!data?.fileTree) {
      return null;
    }

    const state: TraversalState = {
      extensionMap: new Map(),
      languageMap: new Map(),
      unknownExtMap: new Map(),
      binaryCategoryMap: new Map(),
      allCodeFiles: [],
      codeFileCount: 0,
      generatedFileCount: 0,
      generatedLines: 0,
      binaryFileCount: 0,
    };

    traverseTree(data.fileTree, state);

    // Sort extensions by count descending
    const byExtension = Array.from(state.extensionMap.entries())
      .map(([ext, count]) => ({ ext, count }))
      .sort((a, b) => b.count - a.count);

    // Sort languages by lines descending, include colors
    const byLanguage = Array.from(state.languageMap.entries())
      .map(([language, data]) => ({
        language,
        lines: data.lines,
        fileCount: data.fileCount,
        color: getLanguageColor(language),
      }))
      .sort((a, b) => b.lines - a.lines);

    // Unknown extensions
    const unknownExtensions = Array.from(state.unknownExtMap.entries())
      .map(([ext, count]) => ({ ext, count }))
      .sort((a, b) => b.count - a.count);

    // Binary files by category
    const byCategory = Array.from(state.binaryCategoryMap.entries())
      .map(([category, exts]) => ({
        category,
        count: Array.from(exts).reduce((sum, ext) => sum + (state.extensionMap.get(ext) || 0), 0),
        extensions: Array.from(exts).sort(),
      }))
      .sort((a, b) => b.count - a.count);

    // Code-only languages (filter out Unknown, JSON, YAML, etc.)
    const codeLanguages = byLanguage.filter((l) => isCodeLanguage(l.language));

    // Sort files by lines descending and take top 10
    const largestFiles = state.allCodeFiles
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10);

    // Calculate totals
    const totalFiles = Array.from(state.extensionMap.values()).reduce((a, b) => a + b, 0);
    const totalLoc = byLanguage.reduce((sum, item) => sum + item.lines, 0);
    const codeOnlyLoc = codeLanguages.reduce((sum, item) => sum + item.lines, 0);

    return {
      files: {
        total: totalFiles,
        codeFiles: state.codeFileCount,
        generatedFiles: state.generatedFileCount,
        byExtension,
      },
      loc: {
        total: totalLoc,
        codeOnly: codeOnlyLoc,
        excludingGenerated: totalLoc - state.generatedLines,
        byLanguage,
      },
      languages: {
        count: byLanguage.length,
        codeLanguages: codeLanguages.length,
      },
      largestFiles,
      unknownExtensions,
      binary: {
        total: state.binaryFileCount,
        byCategory,
      },
    };
  }, [data]);
}
