const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  files: 'out/test/**/*.test.js',
  version: 'stable',
  workspaceFolder: './test/fixtures/sample-repo',
  mocha: {
    ui: 'tdd',
    timeout: 20000,
    color: true,
  },
  // Download VS Code if not present
  launchArgs: [
    '--disable-extensions',
    '--disable-gpu',
  ],
});
