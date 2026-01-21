/**
 * Basic tests for type definitions.
 */

import { describe, it, expect } from 'vitest';
import {
  RepoStatsError,
  NotAGitRepoError,
  GitNotFoundError,
  SccNotFoundError,
} from './index';

describe('Error Types', () => {
  describe('RepoStatsError', () => {
    it('should create error with message and code', () => {
      const error = new RepoStatsError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('RepoStatsError');
    });
  });

  describe('NotAGitRepoError', () => {
    it('should create error with path in message', () => {
      const error = new NotAGitRepoError('/some/path');
      expect(error.message).toBe('"/some/path" is not a Git repository');
      expect(error.code).toBe('NOT_GIT_REPO');
      expect(error.name).toBe('NotAGitRepoError');
    });
  });

  describe('GitNotFoundError', () => {
    it('should create error with default message', () => {
      const error = new GitNotFoundError();
      expect(error.message).toBe('Git is not installed or not in PATH');
      expect(error.code).toBe('GIT_NOT_FOUND');
      expect(error.name).toBe('GitNotFoundError');
    });
  });

  describe('SccNotFoundError', () => {
    it('should create error with install instructions', () => {
      const error = new SccNotFoundError();
      expect(error.message).toBe(
        'scc binary not found and auto-download failed. ' +
          'Please install scc manually: https://github.com/boyter/scc#install'
      );
      expect(error.code).toBe('SCC_NOT_FOUND');
      expect(error.name).toBe('SccNotFoundError');
    });
  });
});
