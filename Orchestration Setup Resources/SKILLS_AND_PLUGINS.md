# Claude Code Skills and Plugins Guide

This document covers how to create, configure, and use Skills and Plugins for enhanced agentic coding with Claude Code.

## Understanding Skills

Skills are markdown documents that teach Claude project-specific patterns and conventions. When Claude encounters a task matching a skill's purpose, it automatically applies the skill's instructions.

### Skill File Structure

A skill is defined in a `SKILL.md` file with two parts:

```markdown
---
name: my-skill-name
description: What the skill does and when to use it
allowed-tools: Read, Grep, Glob, Bash
---

# Skill Instructions

Your markdown instructions go here. Claude follows these
when the skill is activated.

## Usage Guidelines
- Step-by-step instructions
- Code examples
- Best practices
```

### YAML Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Lowercase letters, numbers, hyphens only |
| `description` | Yes | What the skill does - Claude uses this to decide when to apply |
| `allowed-tools` | No | Comma-separated list (Read, Grep, Glob, Bash, etc.) |

### Skill Directory Structure

```
.claude/
├── skills/
│   ├── code-review/
│   │   └── SKILL.md
│   ├── testing/
│   │   └── SKILL.md
│   └── documentation/
│       └── SKILL.md
├── hooks/
│   └── security-check.sh
└── settings.json
```

## Adding Hooks to Skills

Hooks can be scoped to a skill's lifecycle:

```yaml
---
name: secure-operations
description: Perform operations with security checks
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh"
---
```

**Hook Options**:
- `once: true` - Run only once per session, then remove

## Improving Skill Activation Reliability

Testing shows that proper hooks can achieve 80-84% skill activation success versus 50% with simple approaches.

### Strategies for Reliable Activation

1. **Clear, specific descriptions** - Claude uses the description to match tasks
2. **Keyword matching** - Include relevant keywords in description
3. **Evaluation hooks** - Build systems that analyze prompts and suggest skills
4. **File path triggers** - Associate skills with specific file patterns

## Popular Skill Repositories

### Anthropic's Official Skills

Repository: [github.com/anthropics/skills](https://github.com/anthropics/skills)

**Installation**:
```bash
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

**Included Skills**:
- Document creation & editing (docx, pdf, pptx, xlsx)
- Creative applications (art, music, design)
- Technical tasks (testing web apps, MCP server generation)
- Enterprise workflows

### Netresearch Marketplace

Repository: [github.com/netresearch/claude-code-marketplace](https://github.com/netresearch/claude-code-marketplace)

**Installation**:
```bash
/plugin marketplace add netresearch/claude-code-marketplace
```

**Included Skills**:
- **Coach Plugin** - Friction signal detection, LLM-assisted candidate generation, session transcript analysis
- **CKEditor 5 Development** - Patterns for TYPO3 v12+
- **Jira Integration** - Lightweight Python CLI scripts
- **TYPO3 Skills** - Documentation, testing, DDEV automation

### Community Skills

| Skill | Stars | Description |
|-------|-------|-------------|
| obsidian-skills | 5.3k | Claude Skills for Obsidian integration |
| claude-scientific-skills | 5.2k | Ready-to-use scientific research skills |
| CCPlugins | 2.6k | Time-saving Claude Code Plugins |

## Creating a Plugin

Plugins bundle multiple components into a distributable package:

### Plugin Structure

```
my-plugin/
├── plugin.json          # Plugin metadata
├── skills/
│   └── my-skill/
│       └── SKILL.md
├── commands/
│   └── my-command.md    # Slash commands
├── hooks/
│   └── hook-script.sh
└── mcp/
    └── server-config.json
```

### plugin.json Example

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": "Your Name",
  "skills": ["skills/my-skill"],
  "commands": ["commands/my-command.md"],
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "command": "./hooks/hook-script.sh"
    }]
  }
}
```

### Distribution

Plugins are namespaced to avoid conflicts:
- `/my-plugin:command` - Runs command from my-plugin
- `/plugin list` - Shows installed plugins

## Skills vs CLAUDE.md vs Slash Commands

| Feature | Use Case | Activation |
|---------|----------|------------|
| **CLAUDE.md** | Short, always-true project conventions | Always loaded |
| **Skills** | Richer workflows with supporting files | Auto-applied when relevant |
| **Slash Commands** | Manual invocation from terminal | User types `/command` |

### When to Use Each

- **CLAUDE.md**: Coding standards, project structure, team conventions
- **Skills**: PR review process, deployment workflows, database patterns
- **Slash Commands**: On-demand actions like `/commit`, `/review-pr`

## Skill Factory Tool

For production-scale skill development, check out [Claude Code Skill Factory](https://github.com/alirezarezvani/claude-code-skill-factory):

- Generate structured skill templates
- Automate workflow integration
- Scale AI agent development

## Resources

- [Skills Documentation](https://code.claude.com/docs/en/skills)
- [Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Skill Activation Guide](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably)
- [Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Claude Code Showcase](https://github.com/ChrisWiles/claude-code-showcase) - Comprehensive example with hooks, skills, agents, commands
