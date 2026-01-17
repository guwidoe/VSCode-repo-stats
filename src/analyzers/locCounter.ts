/**
 * LOC Counter - Lines of Code counting using scc binary with fallback.
 * This module has NO VSCode dependencies and is fully testable.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { TreemapNode } from '../types/index.js';

const execAsync = promisify(exec);

// ============================================================================
// Interfaces for Dependency Injection
// ============================================================================

export interface LOCClient {
  countLines(excludePatterns: string[]): Promise<TreemapNode>;
  isSccAvailable(): Promise<boolean>;
}

// ============================================================================
// Language Detection
// ============================================================================

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.swift': 'Swift',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.hpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.cs': 'C#',
  '.php': 'PHP',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.less': 'Less',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.xml': 'XML',
  '.md': 'Markdown',
  '.mdx': 'MDX',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.fish': 'Shell',
  '.sql': 'SQL',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  '.dockerfile': 'Dockerfile',
  '.tf': 'Terraform',
  '.hcl': 'HCL',
  '.lua': 'Lua',
  '.r': 'R',
  '.scala': 'Scala',
  '.clj': 'Clojure',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hs': 'Haskell',
  '.ml': 'OCaml',
  '.fs': 'F#',
  '.fsx': 'F#',
  '.pl': 'Perl',
  '.pm': 'Perl',
  '.dart': 'Dart',
  '.zig': 'Zig',
  '.nim': 'Nim',
  '.v': 'V',
  '.sol': 'Solidity',
};

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();

  // Special cases for files without extensions
  if (baseName === 'dockerfile') {return 'Dockerfile';}
  if (baseName === 'makefile') {return 'Makefile';}
  if (baseName === 'cmakelists.txt') {return 'CMake';}
  if (baseName === 'gemfile') {return 'Ruby';}
  if (baseName === 'rakefile') {return 'Ruby';}
  if (baseName === 'cargo.toml') {return 'TOML';}
  if (baseName === 'go.mod') {return 'Go Module';}
  if (baseName === 'package.json') {return 'JSON';}

  return EXTENSION_TO_LANGUAGE[ext] || 'Unknown';
}

// ============================================================================
// LOC Counter Implementation
// ============================================================================

export class LOCCounter implements LOCClient {
  private repoPath: string;
  private sccAvailable: boolean | null = null;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async isSccAvailable(): Promise<boolean> {
    if (this.sccAvailable !== null) {
      return this.sccAvailable;
    }

    try {
      await execAsync('scc --version');
      this.sccAvailable = true;
    } catch {
      this.sccAvailable = false;
    }

    return this.sccAvailable;
  }

  async countLines(excludePatterns: string[]): Promise<TreemapNode> {
    const useScc = await this.isSccAvailable();

    if (useScc) {
      return this.countWithScc(excludePatterns);
    } else {
      return this.countWithFallback(excludePatterns);
    }
  }

  private async countWithScc(excludePatterns: string[]): Promise<TreemapNode> {
    const excludeArgs = excludePatterns.map(p => `--exclude-dir=${p}`).join(' ');

    try {
      const { stdout } = await execAsync(
        `scc --by-file --format=json ${excludeArgs} "${this.repoPath}"`,
        { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer for large repos
      );

      const sccResult = JSON.parse(stdout);
      return this.buildTreeFromScc(sccResult);
    } catch (error) {
      // Fall back to manual counting if scc fails
      console.warn('scc failed, falling back to manual counting:', error);
      return this.countWithFallback(excludePatterns);
    }
  }

  private buildTreeFromScc(sccResult: SccFileEntry[]): TreemapNode {
    const root: TreemapNode = {
      name: path.basename(this.repoPath),
      path: '',
      type: 'directory',
      lines: 0,
      children: [],
    };

    for (const file of sccResult) {
      const relativePath = file.Location.startsWith(this.repoPath)
        ? file.Location.slice(this.repoPath.length + 1)
        : file.Location;

      const parts = relativePath.split(path.sep);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isFile) {
          const fileNode: TreemapNode = {
            name: part,
            path: currentPath,
            type: 'file',
            lines: file.Code,
            language: file.Language,
          };
          current.children = current.children || [];
          current.children.push(fileNode);
        } else {
          current.children = current.children || [];
          let dirNode = current.children.find(c => c.name === part && c.type === 'directory');
          if (!dirNode) {
            dirNode = {
              name: part,
              path: currentPath,
              type: 'directory',
              lines: 0,
              children: [],
            };
            current.children.push(dirNode);
          }
          current = dirNode;
        }
      }
    }

    // Calculate directory sizes
    this.calculateDirectorySizes(root);

    return root;
  }

  private async countWithFallback(excludePatterns: string[]): Promise<TreemapNode> {
    const root: TreemapNode = {
      name: path.basename(this.repoPath),
      path: '',
      type: 'directory',
      lines: 0,
      children: [],
    };

    await this.walkDirectory(this.repoPath, '', root, excludePatterns);
    this.calculateDirectorySizes(root);

    return root;
  }

  private async walkDirectory(
    absolutePath: string,
    relativePath: string,
    parent: TreemapNode,
    excludePatterns: string[]
  ): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });
    } catch {
      return; // Skip directories we can't read
    }

    for (const entry of entries) {
      const name = entry.name;
      const entryRelativePath = relativePath ? `${relativePath}/${name}` : name;
      const entryAbsolutePath = path.join(absolutePath, name);

      // Check exclude patterns
      if (this.shouldExclude(name, entryRelativePath, excludePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        const dirNode: TreemapNode = {
          name,
          path: entryRelativePath,
          type: 'directory',
          lines: 0,
          children: [],
        };
        parent.children = parent.children || [];
        parent.children.push(dirNode);

        await this.walkDirectory(entryAbsolutePath, entryRelativePath, dirNode, excludePatterns);
      } else if (entry.isFile()) {
        const lines = await this.countFileLines(entryAbsolutePath);
        const language = detectLanguage(name);

        // Get last modified time
        let lastModified: string | undefined;
        try {
          const stat = await fs.promises.stat(entryAbsolutePath);
          lastModified = stat.mtime.toISOString();
        } catch {
          // Ignore stat errors
        }

        const fileNode: TreemapNode = {
          name,
          path: entryRelativePath,
          type: 'file',
          lines,
          language,
          lastModified,
        };
        parent.children = parent.children || [];
        parent.children.push(fileNode);
      }
    }
  }

  private shouldExclude(name: string, relativePath: string, excludePatterns: string[]): boolean {
    // Always exclude hidden files/directories starting with .
    if (name.startsWith('.')) {
      return true;
    }

    for (const pattern of excludePatterns) {
      // Simple pattern matching (supports basic glob-like patterns)
      if (name === pattern || relativePath === pattern) {
        return true;
      }
      // Check if any path segment matches
      if (relativePath.split('/').includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  private async countFileLines(filePath: string): Promise<number> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      // Count non-empty lines (similar to what scc counts as "Code" lines)
      const lines = content.split('\n');
      return lines.filter(line => line.trim().length > 0).length;
    } catch {
      return 0; // Binary files or unreadable files
    }
  }

  private calculateDirectorySizes(node: TreemapNode): number {
    if (node.type === 'file') {
      return node.lines || 0;
    }

    let total = 0;
    for (const child of node.children || []) {
      total += this.calculateDirectorySizes(child);
    }
    node.lines = total;
    return total;
  }
}

// ============================================================================
// SCC Output Types
// ============================================================================

interface SccFileEntry {
  Location: string;
  Language: string;
  Code: number;
  Lines: number;
  Blank: number;
  Comment: number;
  Complexity: number;
}

// ============================================================================
// Factory Function for Dependency Injection
// ============================================================================

export function createLOCCounter(repoPath: string): LOCClient {
  return new LOCCounter(repoPath);
}
