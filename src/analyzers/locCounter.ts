import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { TreemapNode } from '../types';

/**
 * Error thrown when scc binary is not found
 */
export class SCCNotFoundError extends Error {
  constructor() {
    super(
      'scc binary not found. Please install scc: https://github.com/boyter/scc'
    );
    this.name = 'SCCNotFoundError';
  }
}

interface SCCFile {
  Location: string;
  Filename: string;
  Language: string;
  Lines: number;
  Code: number;
  Comments: number;
  Blanks: number;
}

interface SCCOutput {
  Files: SCCFile[];
}

/**
 * Handles LOC (Lines of Code) counting using the scc binary
 */
export class LOCCounter {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  /**
   * Get a treemap structure of the repository
   */
  async getTreemap(): Promise<TreemapNode> {
    const files = await this.countFiles();
    return this.buildTreemap(files);
  }

  /**
   * Count lines of code for all files using scc
   */
  async countFiles(): Promise<SCCFile[]> {
    return new Promise((resolve, reject) => {
      const scc = spawn('scc', ['--by-file', '--format', 'json'], {
        cwd: this.repoPath,
      });

      let stdout = '';
      let stderr = '';

      scc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      scc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      scc.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new SCCNotFoundError());
        } else {
          reject(error);
        }
      });

      scc.on('close', (code) => {
        if (code !== 0) {
          // scc might not be installed, try fallback
          this.fallbackCount()
            .then(resolve)
            .catch(() => reject(new Error(`scc exited with code ${code}: ${stderr}`)));
          return;
        }

        try {
          const output = JSON.parse(stdout) as SCCOutput[];
          // Flatten all language results into a single file list
          const files: SCCFile[] = [];
          for (const lang of output) {
            if (lang.Files) {
              files.push(...lang.Files);
            }
          }
          resolve(files);
        } catch (error) {
          reject(new Error(`Failed to parse scc output: ${error}`));
        }
      });
    });
  }

  /**
   * Fallback LOC counting without scc
   * Uses simple line counting for common file types
   */
  private async fallbackCount(): Promise<SCCFile[]> {
    const files: SCCFile[] = [];
    await this.walkDirectory(this.repoPath, files);
    return files;
  }

  /**
   * Recursively walk directory and count lines
   */
  private async walkDirectory(dir: string, files: SCCFile[]): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.repoPath, fullPath);

      // Skip common ignored directories
      if (
        entry.isDirectory() &&
        ['node_modules', '.git', 'dist', 'build', 'vendor'].includes(entry.name)
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, files);
      } else if (entry.isFile()) {
        const language = this.detectLanguage(entry.name);
        if (language) {
          const lines = await this.countLines(fullPath);
          files.push({
            Location: relativePath,
            Filename: entry.name,
            Language: language,
            Lines: lines,
            Code: lines, // Simplified: treat all lines as code
            Comments: 0,
            Blanks: 0,
          });
        }
      }
    }
  }

  /**
   * Count lines in a file
   */
  private async countLines(filePath: string): Promise<number> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  /**
   * Detect programming language from filename
   */
  private detectLanguage(filename: string): string | null {
    const ext = path.extname(filename).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.rs': 'Rust',
      '.go': 'Go',
      '.java': 'Java',
      '.c': 'C',
      '.cpp': 'C++',
      '.h': 'C Header',
      '.hpp': 'C++ Header',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.html': 'HTML',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.xml': 'XML',
      '.sh': 'Shell',
      '.bash': 'Shell',
      '.sql': 'SQL',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.vue': 'Vue',
      '.svelte': 'Svelte',
    };

    return languageMap[ext] || null;
  }

  /**
   * Build treemap structure from file list
   */
  private buildTreemap(files: SCCFile[]): TreemapNode {
    const root: TreemapNode = {
      name: path.basename(this.repoPath),
      path: '',
      type: 'directory',
      children: [],
    };

    for (const file of files) {
      const parts = file.Location.split(path.sep);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isFile) {
          current.children!.push({
            name: part,
            path: currentPath,
            type: 'file',
            lines: file.Lines,
            language: file.Language,
          });
        } else {
          let dir = current.children!.find(
            (c) => c.name === part && c.type === 'directory'
          );
          if (!dir) {
            dir = {
              name: part,
              path: currentPath,
              type: 'directory',
              children: [],
            };
            current.children!.push(dir);
          }
          current = dir;
        }
      }
    }

    return root;
  }
}
