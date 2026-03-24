import type * as vscode from 'vscode';
import type { CacheStorage } from '../cache/cacheManager.js';

export class WorkspaceStateStorage implements CacheStorage {
  constructor(private state: vscode.Memento) {}

  get<T>(key: string): T | undefined {
    return this.state.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.state.update(key, value);
  }
}
