import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import type { AnalysisBenchmarkTarget, GeneratedRepoFixtureSpec } from './analysisTargets.js';
import {
  buildInitialTextFile,
  buildMutationBlock,
  TEXT_FILE_VARIANTS,
} from './fixtureContent.js';
import {
  fixtureMarkerMatches,
  readFixtureMarker,
  writeFixtureMarker,
  type FixtureMarker,
} from './fixtureMarker.js';
import { benchmarkWorkspaceRoot, runGit } from './environment.js';

const FIXTURE_SCHEMA_VERSION = 1;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, minInclusive: number, maxExclusive: number): number {
  return Math.floor(random() * (maxExclusive - minInclusive)) + minInclusive;
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeTextFile(filePath: string, lines: string[]): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function appendTextFile(filePath: string, lines: string[]): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.appendFile(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function commitFixtureState(targetDir: string, commitIndex: number): void {
  const commitDate = new Date(Date.UTC(2020, 0, 1 + commitIndex, commitIndex % 24, commitIndex % 60, 0));
  const env = {
    GIT_AUTHOR_DATE: commitDate.toISOString(),
    GIT_COMMITTER_DATE: commitDate.toISOString(),
  };

  runGit(targetDir, ['add', '-A'], env);
  runGit(targetDir, ['commit', '-m', `benchmark fixture commit ${commitIndex}`], env);
}

async function createGeneratedRepoFixture(target: AnalysisBenchmarkTarget, targetDir: string): Promise<void> {
  const random = mulberry32(target.fixture.seed);
  await fs.rm(targetDir, { recursive: true, force: true });
  await ensureDirectory(targetDir);

  runGit(targetDir, ['init']);
  runGit(targetDir, ['config', 'user.name', 'Repo Stats Bench']);
  runGit(targetDir, ['config', 'user.email', 'bench@example.com']);

  const trackedTextFiles: string[] = [];
  const generatedFileCount = Math.max(0, target.fixture.maxGeneratedFiles);

  for (let fileIndex = 0; fileIndex < target.fixture.initialFileCount; fileIndex += 1) {
    const variant = TEXT_FILE_VARIANTS[fileIndex % TEXT_FILE_VARIANTS.length];
    const isGenerated = fileIndex < generatedFileCount && fileIndex % 4 === 0;
    const directory = isGenerated ? `generated/module-${fileIndex % 8}` : `${variant.directory}/${fileIndex % 12}`;
    const relativePath = `${directory}/file-${fileIndex}${variant.extension}`;
    trackedTextFiles.push(relativePath);
    await writeTextFile(path.join(targetDir, relativePath), buildInitialTextFile(relativePath, fileIndex));
  }

  for (let binaryIndex = 0; binaryIndex < target.fixture.includeBinaryFiles; binaryIndex += 1) {
    const relativePath = `assets/${binaryIndex % 6}/image-${binaryIndex}.png`;
    await ensureDirectory(path.join(targetDir, path.dirname(relativePath)));
    const size = 256 + (binaryIndex * 17);
    const bytes = Buffer.alloc(size, binaryIndex % 255);
    await fs.writeFile(path.join(targetDir, relativePath), bytes);
  }

  await writeTextFile(path.join(targetDir, '.gitignore'), ['dist/', 'node_modules/']);
  await writeTextFile(path.join(targetDir, 'README.md'), ['# Synthetic benchmark repo', '', target.description]);

  commitFixtureState(targetDir, 0);

  let createdFiles = 0;
  for (let commitIndex = 1; commitIndex < target.fixture.commitCount; commitIndex += 1) {
    const touched = new Set<number>();
    while (touched.size < Math.min(target.fixture.filesTouchedPerCommit, trackedTextFiles.length)) {
      touched.add(randomInt(random, 0, trackedTextFiles.length));
    }

    let mutationIndex = 0;
    for (const fileIndex of touched) {
      const lines = randomInt(random, 1, target.fixture.maxLinesPerMutation + 1);
      await appendTextFile(
        path.join(targetDir, trackedTextFiles[fileIndex]),
        buildMutationBlock(commitIndex, mutationIndex, lines)
      );
      mutationIndex += 1;
    }

    if (
      target.fixture.createFileEvery > 0 &&
      commitIndex % target.fixture.createFileEvery === 0 &&
      createdFiles < target.fixture.maxGeneratedFiles
    ) {
      const variantIndex = randomInt(random, 0, TEXT_FILE_VARIANTS.length);
      const variant = TEXT_FILE_VARIANTS[variantIndex];
      const relativePath = `src/growth/${variantIndex}/created-${commitIndex}${variant.extension}`;
      trackedTextFiles.push(relativePath);
      createdFiles += 1;
      await writeTextFile(path.join(targetDir, relativePath), buildInitialTextFile(relativePath, commitIndex));
    }

    if (commitIndex % 25 === 0) {
      await appendTextFile(path.join(targetDir, 'README.md'), [`- checkpoint ${commitIndex}`]);
    }

    commitFixtureState(targetDir, commitIndex);
  }

  const marker: FixtureMarker<GeneratedRepoFixtureSpec> = {
    schemaVersion: FIXTURE_SCHEMA_VERSION,
    targetName: target.name,
    fixture: target.fixture,
  };
  await writeFixtureMarker(path.join(targetDir, '.repo-stats-benchmark-fixture.json'), marker);
}

export async function ensureGeneratedFixture(target: AnalysisBenchmarkTarget): Promise<string> {
  const targetDir = path.join(benchmarkWorkspaceRoot(), target.name);
  const markerPath = path.join(targetDir, '.repo-stats-benchmark-fixture.json');

  if (existsSync(markerPath)) {
    const marker = await readFixtureMarker<GeneratedRepoFixtureSpec>(markerPath);
    if (
      fixtureMarkerMatches({
        marker,
        schemaVersion: FIXTURE_SCHEMA_VERSION,
        targetName: target.name,
        fixture: target.fixture,
      }) &&
      existsSync(path.join(targetDir, '.git'))
    ) {
      return targetDir;
    }
  }

  await createGeneratedRepoFixture(target, targetDir);
  return targetDir;
}
