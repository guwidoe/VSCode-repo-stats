/**
 * SCC Binary Manager - Handles SCC binary resolution and auto-download.
 * This module has NO VSCode dependencies and is fully testable.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import * as https from 'https';

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

const SCC_VERSION = '3.5.0';
const GITHUB_RELEASE_BASE = 'https://github.com/boyter/scc/releases/download';

// Binary naming conventions from GitHub releases
const BINARY_NAMES: Record<string, Record<string, string>> = {
  linux: {
    x64: `scc_${SCC_VERSION}_Linux_x86_64.tar.gz`,
    arm64: `scc_${SCC_VERSION}_Linux_arm64.tar.gz`,
  },
  darwin: {
    x64: `scc_${SCC_VERSION}_Darwin_x86_64.tar.gz`,
    arm64: `scc_${SCC_VERSION}_Darwin_arm64.tar.gz`,
  },
  win32: {
    x64: `scc_${SCC_VERSION}_Windows_x86_64.zip`,
  },
};

// ============================================================================
// Types
// ============================================================================

export interface SccInfo {
  version: string;
  source: 'system' | 'downloaded' | 'none';
}

// ============================================================================
// SCC Binary Manager Implementation
// ============================================================================

export class SccBinaryManager {
  private storagePath: string;
  private cachedBinaryPath: string | null = null;
  private cachedSource: 'system' | 'downloaded' | 'none' = 'none';

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  /**
   * Get the path to the scc binary, checking in order:
   * 1. System PATH
   * 2. Previously downloaded binary in extension storage
   * Returns null if neither is available.
   */
  async getBinaryPath(): Promise<string | null> {
    if (this.cachedBinaryPath) {
      return this.cachedBinaryPath;
    }

    // Check system PATH first (user preference)
    const systemPath = await this.getSystemBinaryPath();
    if (systemPath) {
      this.cachedBinaryPath = systemPath;
      this.cachedSource = 'system';
      return systemPath;
    }

    // Check for downloaded binary
    const downloadedPath = await this.getDownloadedBinaryPath();
    if (downloadedPath) {
      this.cachedBinaryPath = downloadedPath;
      this.cachedSource = 'downloaded';
      return downloadedPath;
    }

    return null;
  }

  /**
   * Check if scc is available in system PATH.
   */
  async getSystemBinaryPath(): Promise<string | null> {
    try {
      const command = process.platform === 'win32' ? 'where scc' : 'which scc';
      const { stdout } = await execAsync(command);
      const sccPath = stdout.trim().split('\n')[0];

      // Verify it actually works
      await execAsync(`"${sccPath}" --version`);
      return sccPath;
    } catch {
      return null;
    }
  }

  /**
   * Get path to previously downloaded binary, if it exists and is executable.
   */
  async getDownloadedBinaryPath(): Promise<string | null> {
    const binaryPath = this.getExpectedBinaryPath();

    try {
      await fs.promises.access(binaryPath, fs.constants.X_OK);
      // Verify it works
      await execAsync(`"${binaryPath}" --version`);
      return binaryPath;
    } catch {
      return null;
    }
  }

  /**
   * Download and extract the scc binary for the current platform.
   * @throws Error if download fails or platform is unsupported
   */
  async downloadBinary(
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const platform = process.platform as 'linux' | 'darwin' | 'win32';
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

    const archiveName = BINARY_NAMES[platform]?.[arch];
    if (!archiveName) {
      throw new Error(
        `Unsupported platform: ${platform}-${arch}. ` +
          'Please install scc manually: https://github.com/boyter/scc#install'
      );
    }

    const downloadUrl = `${GITHUB_RELEASE_BASE}/v${SCC_VERSION}/${archiveName}`;
    const archivePath = path.join(this.storagePath, archiveName);
    const binaryPath = this.getExpectedBinaryPath();

    // Ensure storage directory exists
    await fs.promises.mkdir(this.storagePath, { recursive: true });

    // Download the archive
    onProgress?.(0);
    await this.downloadFile(downloadUrl, archivePath, (percent) => {
      onProgress?.(Math.round(percent * 0.7)); // 70% for download
    });

    // Extract the binary
    onProgress?.(70);
    await this.extractArchive(archivePath, this.storagePath, platform);

    // Make executable on Unix
    if (platform !== 'win32') {
      await fs.promises.chmod(binaryPath, 0o755);
    }

    // Clean up archive file
    await fs.promises.unlink(archivePath).catch(() => {});

    // Verify it works
    onProgress?.(90);
    try {
      await execAsync(`"${binaryPath}" --version`);
    } catch (error) {
      throw new Error(
        `Downloaded scc binary failed verification. ` +
          'Please install scc manually: https://github.com/boyter/scc#install'
      );
    }

    this.cachedBinaryPath = binaryPath;
    this.cachedSource = 'downloaded';

    onProgress?.(100);
    return binaryPath;
  }

  /**
   * Get information about the current scc installation.
   */
  async getSccInfo(): Promise<SccInfo> {
    const binaryPath = await this.getBinaryPath();

    if (!binaryPath) {
      return { version: '', source: 'none' };
    }

    try {
      const { stdout } = await execAsync(`"${binaryPath}" --version`);
      const version = stdout.trim().split('\n')[0];
      return { version, source: this.cachedSource };
    } catch {
      return { version: SCC_VERSION, source: this.cachedSource };
    }
  }

  /**
   * Get the expected path for the downloaded binary.
   */
  private getExpectedBinaryPath(): string {
    const binaryName = process.platform === 'win32' ? 'scc.exe' : 'scc';
    return path.join(this.storagePath, binaryName);
  }

  /**
   * Download a file with progress reporting.
   */
  private downloadFile(
    url: string,
    destPath: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const makeRequest = (requestUrl: string) => {
        const urlObj = new URL(requestUrl);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          headers: {
            'User-Agent': 'VSCode-RepoStats-Extension',
          },
        };

        const request = https.get(options, (response) => {
          // Handle redirects
          if (
            (response.statusCode === 301 || response.statusCode === 302) &&
            response.headers.location
          ) {
            makeRequest(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Download failed with status ${response.statusCode}. ` +
                  'Please install scc manually: https://github.com/boyter/scc#install'
              )
            );
            return;
          }

          const totalSize = parseInt(
            response.headers['content-length'] || '0',
            10
          );
          let downloadedSize = 0;

          const file = createWriteStream(destPath);

          response.on('data', (chunk: Buffer) => {
            downloadedSize += chunk.length;
            if (totalSize > 0 && onProgress) {
              onProgress((downloadedSize / totalSize) * 100);
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

          file.on('error', (err) => {
            fs.promises.unlink(destPath).catch(() => {});
            reject(err);
          });
        });

        request.on('error', (err) => {
          reject(
            new Error(
              `Download failed: ${err.message}. ` +
                'Please install scc manually: https://github.com/boyter/scc#install'
            )
          );
        });
      };

      makeRequest(url);
    });
  }

  /**
   * Extract archive (tar.gz or zip) to destination directory.
   */
  private async extractArchive(
    archivePath: string,
    destDir: string,
    platform: string
  ): Promise<void> {
    if (platform === 'win32') {
      // Use PowerShell on Windows for zip files
      await execAsync(
        `powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`
      );
    } else {
      // Use tar for tar.gz on Unix-like systems
      await execAsync(`tar -xzf "${archivePath}" -C "${destDir}"`);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSccBinaryManager(storagePath: string): SccBinaryManager {
  return new SccBinaryManager(storagePath);
}
