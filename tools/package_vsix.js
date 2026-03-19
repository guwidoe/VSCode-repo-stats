#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'dist', 'vsix');
const packageJsonPath = path.join(repoRoot, 'package.json');
const args = process.argv.slice(2);

const cleanOnly = args.includes('--clean');
const keepArg = args.find((arg) => arg.startsWith('--keep='));
const keepCount = keepArg ? Number.parseInt(keepArg.split('=')[1], 10) : 8;

function getVsixFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((fileName) => fileName.endsWith('.vsix'))
    .map((fileName) => path.join(dirPath, fileName))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function pruneOldPackages() {
  if (!Number.isFinite(keepCount) || keepCount < 1) {
    return;
  }

  const files = getVsixFiles(outputDir);
  const stale = files.slice(keepCount);

  for (const filePath of stale) {
    fs.rmSync(filePath, { force: true });
    console.log(`Removed old package: ${path.relative(repoRoot, filePath)}`);
  }
}

fs.mkdirSync(outputDir, { recursive: true });

if (cleanOnly) {
  pruneOldPackages();
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const outputFile = path.join(outputDir, `${pkg.name}-${pkg.version}.vsix`);

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npxCommand,
  ['vsce', 'package', '--no-dependencies', '--out', outputFile],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  }
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Packaged: ${path.relative(repoRoot, outputFile)}`);
pruneOldPackages();
