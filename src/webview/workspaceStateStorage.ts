import type * as vscode from 'vscode';
import type { CacheStorage } from '../cache/cacheManager.js';

export class WorkspaceStateStorage implements CacheStorage {
  constructor(private state: vscode.Memento) {}

  get<T>(key: string): T | undefined {
    return this.state.get<T>(key);
  }

  set<T>(key: string, value: T): void {
    this.state.update(key, value);
  }
}
