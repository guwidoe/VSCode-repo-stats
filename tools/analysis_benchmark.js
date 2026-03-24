#!/usr/bin/env node
require('ts-node').register({
  transpileOnly: true,
  experimentalResolver: true,
});

const { runAnalysisBenchmarkCli } = require('./benchmarks/analysisBenchmark.ts');

runAnalysisBenchmarkCli(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
