# Claude Code Plugins & Skills Ecosystem Overview

This document provides an overview of the Claude Code plugins, skills, and extensions ecosystem for agentic coding.

## What is Claude Code?

Claude Code is Anthropic's official agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster through natural language commands. It can execute routine tasks, explain complex code, and handle git workflows autonomously.

## Key Concepts

### Skills

**Skills** are markdown files that teach Claude how to do something specific. They can include:
- Reviewing PRs using your team's standards
- Generating commit messages in your preferred format
- Querying your company's database schema

When you ask Claude something that matches a Skill's purpose, Claude automatically applies it.

**Structure**: A `SKILL.md` file contains:
- YAML metadata (between `---` markers) with `name`, `description`, and `allowed-tools`
- Markdown instructions that tell Claude how to use the skill

### MCP Servers (Model Context Protocol)

**MCP Servers** act as bridges connecting Claude Code to external tools, APIs, and data sources. They enable real-time interactions with systems like GitHub, databases, and web browsers.

- Skills tell Claude *how* to use tools
- MCP provides the *tools* themselves

### Plugins

**Plugins** are packaging mechanisms that bundle skills, slash commands, sub-agents, hooks, and MCP servers into a single distributable unit. They can be installed via `/plugins` and are namespaced to avoid conflicts.

### Hooks

**Hooks** are shell commands that execute at various lifecycle points:
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool completion
- `Notification` - When Claude sends notifications
- `Stop` - When Claude finishes responding

## Distribution Methods

| Method | Use Case |
|--------|----------|
| **Project Skills** | Commit `.claude/skills/` to version control. Anyone who clones the repo gets the skills. |
| **Plugins** | Share skills across multiple repositories via plugin marketplaces |
| **MCP Servers** | Provide tool integrations that skills can leverage |

## Key Marketplaces & Repositories

### Official Resources
- [Anthropic Skills Repository](https://github.com/anthropics/skills) - Official public repository for Agent Skills
- [Claude Code Documentation](https://code.claude.com/docs/en/skills) - Official skills documentation

### Community Marketplaces
- [Netresearch Claude Code Marketplace](https://github.com/netresearch/claude-code-marketplace) - Curated skills collection with automated sync workflow
- [SkillsMP](https://skillsmp.com/) - Agent Skills Marketplace supporting Claude, Codex & ChatGPT
- [Claude-Plugins.dev](https://claude-plugins.dev/) - Community registry with CLI support

### Curated Lists
- [Awesome Claude Code](https://github.com/jmanhype/awesome-claude-code) - Plugins, MCP servers, editor integrations
- [Awesome Claude Skills](https://github.com/travisvn/awesome-claude-skills) - Curated skills and tools
- [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers) - Collection of MCP servers

## Popular Skill Categories

Based on the ecosystem, popular skill categories include:

1. **Development Workflows** - CI/CD, testing, code review
2. **Documentation** - API docs, README generation, changelogs
3. **Database Operations** - Query patterns, schema management
4. **DevOps** - DDEV, Docker, infrastructure automation
5. **Creative Applications** - Art, music, design assistance
6. **Enterprise Workflows** - Jira integration, project management
7. **Scientific Computing** - Research and data analysis tools

## Getting Started

### Install a Plugin Marketplace
```bash
/plugin marketplace add netresearch/claude-code-marketplace
```

### Install a Skill
```bash
/plugin install document-skills@anthropic-agent-skills
```

### Add an MCP Server
```bash
claude mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
```

## Resources

- [Claude Code GitHub](https://github.com/anthropics/claude-code) - 55k+ stars
- [Agent Skills Blog Post](https://claude.com/blog/skills) - Introducing Agent Skills
- [Desktop Extensions](https://www.anthropic.com/engineering/desktop-extensions) - One-click MCP server installation

---

*Note: The Agent Skills specification was released by Anthropic in December 2025 as an open standard, and OpenAI adopted the same format for Codex CLI and ChatGPT.*
