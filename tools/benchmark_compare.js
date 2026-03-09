#!/usr/bin/env node
require('ts-node').register({
  transpileOnly: true,
  experimentalResolver: true,
});

const fs = require('fs');
const path = require('path');
const {
  compareBenchmarkRuns,
  formatBenchmarkComparisonReport,
} = require('../src/benchmarks/benchmarkComparison.ts');

function parseArgs(argv) {
  const args = [...argv];
  const parsed = {
    warnPercent: 5,
    failPercent: 15,
    minimumInterestingPhaseMs: 10,
    json: false,
    baselinePath: '',
    currentPath: '',
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--warn-pct') {
      parsed.warnPercent = Number(args.shift());
      continue;
    }
    if (arg === '--fail-pct') {
      parsed.failPercent = Number(args.shift());
      continue;
    }
    if (arg === '--min-phase-ms') {
      parsed.minimumInterestingPhaseMs = Number(args.shift());
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (!parsed.baselinePath) {
      parsed.baselinePath = path.resolve(arg);
      continue;
    }
    if (!parsed.currentPath) {
      parsed.currentPath = path.resolve(arg);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.baselinePath || !parsed.currentPath) {
    throw new Error('Usage: tools/benchmark_compare.js <baseline.json> <current.json> [--warn-pct N] [--fail-pct N] [--min-phase-ms N] [--json]');
  }

  return parsed;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const baseline = JSON.parse(fs.readFileSync(parsed.baselinePath, 'utf8'));
  const current = JSON.parse(fs.readFileSync(parsed.currentPath, 'utf8'));
  const report = compareBenchmarkRuns(baseline, current, {
    warnPercent: parsed.warnPercent,
    failPercent: parsed.failPercent,
    minimumInterestingPhaseMs: parsed.minimumInterestingPhaseMs,
  });

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatBenchmarkComparisonReport(report)}\n`);
  }

  process.exit(report.hasRegression ? 1 : 0);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
