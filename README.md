# Repo Stats

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/guwidoe.vscode-repo-stats)](https://marketplace.visualstudio.com/items?itemName=guwidoe.vscode-repo-stats)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/guwidoe.vscode-repo-stats)](https://marketplace.visualstudio.com/items?itemName=guwidoe.vscode-repo-stats)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Visualize your repository statistics directly in VS Code with interactive dashboards, charts, and treemaps. Get insights into contributor activity, code frequency, and codebase structure at a glance.

## Features

### Overview Dashboard

Get a quick summary of your repository with key statistics:

- Total files and lines of code
- Language distribution with donut chart
- File type breakdown
- Largest files in the codebase
- Generated file detection

![Overview Panel](media/screenshot-overview.png)

### Contributors Dashboard

Analyze contributor activity with GitHub Insights-style visualizations:

- Commits over time (weekly/monthly granularity)
- Lines added and deleted per contributor
- Interactive time range slider
- Sparkline charts for each contributor

![Contributors Panel](media/screenshot-contributors.png)

### Code Frequency

Track additions and deletions over time:

- Stacked bar chart showing weekly or monthly activity
- Summary cards with total additions, deletions, and net change
- Adjustable time range filter

![Code Frequency Panel](media/screenshot-frequency.png)

### Repository Treemap

Explore your codebase structure with an interactive treemap:

- **WizTree-inspired design** with nested hierarchy and vignette shading
- **Color modes**: By language (GitHub Linguist colors) or by file age (heat map)
- **Size modes**: Lines of code, file size in bytes, or file count
- **Adjustable nesting depth** (1-10 levels)
- **Smart filtering**: Presets for All, No Binary, Code Only, or custom language selection
- **Rich interactions**: Click to drill down, double-click to open files, right-click context menu
- **Keyboard navigation**: Escape to clear selection, Backspace to go up

![Treemap Panel](media/screenshot-treemap.png)

### Settings Panel

Customize the extension behavior:

- Exclude patterns (in addition to .gitignore)
- Generated file patterns
- Binary file extensions
- Maximum commits to analyze
- Default color mode

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Repo Stats"
4. Click **Install**

### From VSIX

1. Download the `.vsix` file from [Releases](https://github.com/guwidoe/vscode-repo-stats/releases)
2. In VS Code, open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Run `Extensions: Install from VSIX...`
4. Select the downloaded file

## Usage

1. Open a folder containing a Git repository
2. Run the command **Repo Stats: Show Dashboard** from the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Or click the **Repo Stats** button in the status bar

The extension will analyze your repository and display the dashboard. Results are cached based on the current Git HEAD, so subsequent opens are instant.

### Commands

| Command                      | Description                   |
| ---------------------------- | ----------------------------- |
| `Repo Stats: Show Dashboard` | Open the statistics dashboard |
| `Repo Stats: Refresh`        | Clear cache and re-analyze    |

## Requirements

- **VS Code** 1.85.0 or higher
- **Git** must be installed and available in PATH
- **scc** (Sloc Cloc and Code) - automatically downloaded if not found in PATH

### About scc

This extension uses [scc](https://github.com/boyter/scc) for accurate lines-of-code counting. It's a fast, accurate code counter that supports 200+ languages.

- If `scc` is in your PATH, the extension uses it directly
- If not found, the extension automatically downloads the appropriate binary for your platform
- Supported platforms: Windows (x64, arm64), macOS (x64, arm64), Linux (x64, arm64)

## Extension Settings

| Setting                         | Default      | Description                                         |
| ------------------------------- | ------------ | --------------------------------------------------- |
| `repoStats.excludePatterns`     | `[]`         | Additional directories to exclude beyond .gitignore |
| `repoStats.maxCommitsToAnalyze` | `10000`      | Maximum commits to analyze (for performance)        |
| `repoStats.defaultColorMode`    | `"language"` | Default treemap color mode (`language` or `age`)    |
| `repoStats.generatedPatterns`   | See below    | Glob patterns to identify generated files           |
| `repoStats.binaryExtensions`    | See below    | File extensions considered as binary                |

![Repo Stats Overview](media/screenshot-settings.png)

### Default Generated Patterns

```json
[
  "**/generated/**", "**/gen/**", "**/__generated__/**",
  "**/dist/**", "**/build/**", "**/*.generated.*",
  "**/*.min.js", "**/*.min.css", "**/package-lock.json", ...
]
```

### Default Binary Extensions

```json
[".png", ".jpg", ".gif", ".mp4", ".mp3", ".ttf", ".woff2", ".zip", ".exe", ".pdf", ...]
```

## Performance

Repo Stats is designed to handle large repositories efficiently:

- **Caching**: Results cached by Git HEAD SHA - instant reload if no new commits
- **Progress reporting**: Visual feedback during analysis
- **Commit limits**: Configurable maximum commits to analyze
- **Canvas rendering**: Treemap uses HTML5 Canvas for smooth performance with 50K+ files

For very large repositories, consider:

- Reducing `maxCommitsToAnalyze` if contributor analysis is slow
- Using exclude patterns for large vendored or generated directories

## Known Issues

- **Large monorepos**: First analysis may take longer; subsequent loads are cached
- **Submodules**: Automatically detected and excluded from analysis
- **Binary files**: Shown in treemap with 0 LOC; use "Size (Bytes)" mode to see their actual size

## Contributing

Contributions are welcome! Please see the [GitHub repository](https://github.com/guwidoe/vscode-repo-stats) for:

- [Issue tracker](https://github.com/guwidoe/vscode-repo-stats/issues)
- Development setup instructions
- Contribution guidelines

### Development

```bash
# Clone the repository
git clone https://github.com/guwidoe/vscode-repo-stats.git
cd vscode-repo-stats

# Install dependencies
npm install
cd webview-ui && npm install && cd ..

# Build
npm run build

# Watch mode (for development)
npm run watch

# Run tests
npm run test

# Package extension
npm run package
```

## Release Notes

### 0.0.1

Initial release:

- Overview dashboard with repository statistics
- Contributors panel with commit charts and sparklines
- Code frequency graph
- Interactive treemap with multiple color/size modes
- Settings panel for customization
- Automatic scc binary download

## License

[MIT](LICENSE)

---

**Enjoy!** If you find this extension useful, please consider [leaving a review](https://marketplace.visualstudio.com/items?itemName=guwidoe.vscode-repo-stats&ssr=false#review-details) or [starring the repository](https://github.com/guwidoe/vscode-repo-stats).
