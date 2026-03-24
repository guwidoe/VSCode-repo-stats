import * as fs from 'fs/promises';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fixtureMarkerMatches,
  readFixtureMarker,
  writeFixtureMarker,
} from './fixtureMarker.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('fixtureMarker', () => {
  it('round-trips a fixture marker through disk', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'repo-stats-fixture-marker-'));
    tempDirs.push(dir);
    const markerPath = path.join(dir, 'fixture.json');
    const marker = {
      schemaVersion: 1,
      targetName: 'synthetic-medium',
      fixture: { commitCount: 10 },
    };

    await writeFixtureMarker(markerPath, marker);
    await expect(readFixtureMarker<{ commitCount: number }>(markerPath)).resolves.toEqual(marker);
  });

  it('throws a helpful error for malformed JSON', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'repo-stats-fixture-marker-'));
    tempDirs.push(dir);
    const markerPath = path.join(dir, 'fixture.json');
    await fs.writeFile(markerPath, '{ not-valid-json }', 'utf8');

    await expect(readFixtureMarker(markerPath)).rejects.toThrow(/Failed to parse benchmark fixture marker/);
  });

  it('compares marker metadata against the expected fixture', () => {
    expect(fixtureMarkerMatches({
      marker: {
        schemaVersion: 1,
        targetName: 'synthetic-medium',
        fixture: { commitCount: 10 },
      },
      schemaVersion: 1,
      targetName: 'synthetic-medium',
      fixture: { commitCount: 10 },
    })).toBe(true);

    expect(fixtureMarkerMatches({
      marker: {
        schemaVersion: 1,
        targetName: 'synthetic-medium',
        fixture: { commitCount: 10 },
      },
      schemaVersion: 2,
      targetName: 'synthetic-medium',
      fixture: { commitCount: 10 },
    })).toBe(false);
  });
});
