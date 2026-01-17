# Claude Code Best Practices Guide (2026)

A comprehensive guide for effective agentic coding with Claude Code, synthesized from Anthropic's official documentation and community best practices.

---

## Table of Contents

1. [Core Workflow: Explore, Plan, Code, Commit](#core-workflow-explore-plan-code-commit)
2. [CLAUDE.md Configuration](#claudemd-configuration)
3. [Context Management](#context-management)
4. [Test-Driven Development](#test-driven-development)
5. [Custom Slash Commands](#custom-slash-commands)
6. [Prompt Engineering](#prompt-engineering)
7. [Visual Context & Screenshots](#visual-context--screenshots)
8. [Long-Running Workflows](#long-running-workflows)
9. [Multi-Agent Patterns](#multi-agent-patterns)
10. [MCP Integration](#mcp-integration)
11. [Git Integration](#git-integration)
12. [Headless Mode & Automation](#headless-mode--automation)
13. [Permission Management](#permission-management)
14. [Troubleshooting & Course Correction](#troubleshooting--course-correction)

---

## Core Workflow: Explore, Plan, Code, Commit

The most effective strategy is to **explicitly prevent Claude from writing code at the start of a task**. This counter-intuitive approach significantly improves performance for problems requiring deeper thinking.

### The Four-Step Pattern

1. **Explore**
   - Ask Claude to read relevant files and understand the codebase
   - Have it identify dependencies, patterns, and conventions
   - Example: *"Read the authentication module and understand how user sessions are managed. Don't write any code yet."*

2. **Plan**
   - Request a detailed implementation plan
   - Use extended thinking keywords for complex problems:
     - `"think"` — Standard deliberation
     - `"think hard"` — More thorough analysis
     - `"think harder"` — Deep consideration
     - `"ultrathink"` — Maximum deliberation
   - Example: *"Think hard about how to implement rate limiting. Create a detailed plan before writing any code."*

3. **Code**
   - Request implementation after approving the plan
   - Verify the solution is reasonable as it progresses
   - Example: *"The plan looks good. Implement step 1 and 2, then pause for review."*

4. **Commit**
   - Ask Claude to commit with contextual messages
   - Have it create pull requests when appropriate
   - Example: *"Commit these changes with a descriptive message explaining the rate limiting implementation."*

---

## CLAUDE.md Configuration

`CLAUDE.md` is a special file that Claude automatically incorporates into context at the start of conversations.

### File Locations & Scope

| Location | Scope |
|----------|-------|
| Repository root | Project-wide conventions |
| Parent directories | Inherited by subdirectories |
| Child directories | Module-specific context |
| `~/.claude/CLAUDE.md` | Personal preferences (all projects) |

### What to Include

```markdown
# Project: MyApp

## Build & Test Commands
- `npm run build` — Build the project
- `npm test` — Run all tests
- `npm run lint` — Check code style

## Code Style
- Use TypeScript strict mode
- Prefer functional components with hooks
- IMPORTANT: All API calls must go through the `api/` module

## Common Mistakes to Avoid
- YOU MUST NOT use `any` type without explicit justification
- Never commit `.env` files
- Always handle loading and error states in UI components

## Architecture Notes
- Authentication uses JWT tokens stored in httpOnly cookies
- Database queries go through the repository pattern in `src/repositories/`
```

### Best Practices for CLAUDE.md

- Keep it **concise and human-readable**
- Use emphasis language: `"IMPORTANT"`, `"YOU MUST"`, `"NEVER"`
- Treat it as a **living document** — update it as you discover issues
- Use the `#` key during sessions to add instructions automatically
- Teams can use `@.claude` tags on PRs to add learnings

---

## Context Management

### Use `/clear` Frequently

Wipe conversation history between different tasks to prevent context confusion:
- After completing a feature
- When switching to a different area of the codebase
- When Claude seems confused by previous context

### Delegate to Sub-agents

For complex multi-step workflows, keep contexts separate:

```
"You just wrote the code for the payment processor.
Now, use a sub-agent to perform a security review of that code."
```

Sub-agents:
- Have their own isolated context
- Can verify work independently
- Are efficient early in conversations when context is plentiful

### Track Progress Externally

For workflows spanning multiple sessions:
- Maintain checklists as Markdown files
- Use GitHub issues to track progress
- Create progress tracking files alongside version control

---

## Test-Driven Development

TDD becomes especially powerful with agentic coding.

### TDD Workflow

1. **Request tests first**
   ```
   "Write tests for the UserService.authenticate() method based on these requirements:
   - Valid credentials return a session token
   - Invalid password returns AuthenticationError
   - Locked account returns AccountLockedError

   I'm doing TDD, so don't create any implementation code yet."
   ```

2. **Verify tests fail** — Ensure no mock implementations sneak in

3. **Commit the tests** — Lock in the expected behavior

4. **Request implementation**
   ```
   "Now implement UserService.authenticate() to make all tests pass."
   ```

5. **Verify with sub-agents** — Have a separate agent check the implementation isn't overfitting

6. **Commit the implementation**

### Key Points

- Be explicit that you're doing TDD
- Specify that mocks should be avoided when possible
- Request edge case coverage upfront

---

## Custom Slash Commands

Store reusable prompt templates for repeated workflows.

### Setup

Create Markdown files in `.claude/commands/`:

```
.claude/
└── commands/
    ├── review.md
    ├── debug.md
    └── migration.md
```

### Example: `.claude/commands/review.md`

```markdown
Review the following code for:
1. Security vulnerabilities (injection, XSS, etc.)
2. Performance issues
3. Error handling gaps
4. Test coverage

File to review: $ARGUMENTS

Provide specific line numbers and suggested fixes.
```

### Usage

Type `/review src/api/auth.ts` in Claude Code to invoke.

### Locations

| Location | Visibility |
|----------|------------|
| `.claude/commands/` | Project-specific, shareable via git |
| `~/.claude/commands/` | Personal, all projects |

---

## Prompt Engineering

### Be Specific, Not Vague

| Instead of... | Say... |
|---------------|--------|
| "Add tests for foo.py" | "Write a test case for foo.py covering the edge case where the user is logged out. Avoid mocks." |
| "Fix the bug" | "Fix the null pointer exception in UserService.getProfile() when the user has no avatar set." |
| "Make it faster" | "Optimize the database query in getOrders() by adding an index on customer_id and using pagination." |

### Provide Context Upfront

```
"I'm working on a React Native app that uses Redux for state management.
The app targets iOS and Android. We use TypeScript with strict mode.

Add a new screen for user settings that follows our existing patterns in src/screens/."
```

### Use File and URL References

- Use tab-completion to reference specific files
- Paste URLs for Claude to fetch and read
- Add frequently-used domains to your allowlist via `/permissions`

---

## Visual Context & Screenshots

Claude excels with images and diagrams.

### How to Provide Visual Context

- **macOS clipboard**: Cmd+Ctrl+Shift+4 captures to clipboard, then paste
- **Drag-and-drop**: Drop images directly into the terminal
- **File paths**: Reference image files by path

### Use Cases

- Design mockups for UI implementation
- Screenshots for visual debugging
- Architecture diagrams for planning
- Error screenshots for troubleshooting

### Iteration Tip

Request **2-3 iterations** for visual matching tasks — this typically yields significantly better results than single-pass attempts.

---

## Long-Running Workflows

For complex projects that span multiple sessions.

### Two-Agent Architecture

1. **Initializer Agent** — Sets up the environment on first run
   - Creates feature lists (JSON format)
   - Initializes git repository
   - Establishes progress tracking

2. **Coding Agent** — Makes incremental progress
   - Works on one feature per session
   - Leaves clear artifacts for next session
   - Commits with descriptive messages

### Session Protocol

**Start each session by:**
1. Verify working directory access
2. Read git logs and progress files
3. Review remaining features
4. Run development server health checks

**End each session by:**
1. Ensure code is in a clean state
2. Commit all changes with descriptive messages
3. Update progress tracking file
4. Document any blockers or notes for next session

### Key Principles

- **One feature per session** — Avoid comprehensive implementation attempts
- **Clean code states** — Never end with broken builds
- **Descriptive commits** — Enable context recovery
- **Progress documentation** — Bridge the gap between sessions

---

## Multi-Agent Patterns

### Parallel Verification

Have one instance write code while another verifies:

```
Terminal 1: Claude writes the implementation
Terminal 2: Claude reviews and tests independently
```

### Isolated Workspaces

Run multiple Claude instances with separate working directories:

```bash
# Option 1: Separate checkouts
cd ~/projects/myapp-feature-a
claude

cd ~/projects/myapp-feature-b
claude

# Option 2: Git worktrees
git worktree add ../myapp-feature-a feature-a
git worktree add ../myapp-feature-b feature-b
```

### Specialized Sub-agents

Break complex workflows into specialized agents:

- **Security review agent** — Focuses on vulnerabilities
- **Performance audit agent** — Identifies bottlenecks
- **Documentation agent** — Writes and updates docs
- **Test generation agent** — Creates comprehensive tests

---

## MCP Integration

Model Context Protocol extends Claude's capabilities.

### Configuration Locations

| Location | Scope |
|----------|-------|
| Project config | Current directory only |
| Global config | All projects |
| `.mcp.json` (checked in) | Team-wide access |

### Common Integrations

- **Playwright** — Browser automation for web testing
  ```
  "Move the location of this div, and check that it's worked using Playwright."
  ```

- **Database access** — Query and inspect data
- **Custom APIs** — Integrate internal tools

### Troubleshooting

Use the `--mcp-debug` flag when configuration isn't working as expected.

---

## Git Integration

Claude handles git operations effectively.

### Capabilities

- Search git history for changes and ownership
- Write contextually-aware commit messages
- Handle complex operations like rebase conflict resolution
- Create and manage pull requests

### Example Prompts

```
"Search git history to find when the authentication module was last modified and by whom."

"Commit these changes with a message that follows our conventional commits format."

"Help me resolve these rebase conflicts, preferring the changes from main for config files."

"Create a PR with a description summarizing all the changes in this branch."
```

---

## Headless Mode & Automation

For CI/CD, pre-commit hooks, and automation.

### Basic Usage

```bash
claude -p "Your prompt here" --output-format stream-json
```

### Use Cases

- **GitHub issue triage** — Automatic labeling and categorization
- **Code review** — Subjective analysis beyond linting
- **Large-scale migrations** — Fan out tasks across files
- **Data pipelines** — Integrate Claude into existing workflows

### Example: Pre-commit Hook

```bash
#!/bin/bash
claude -p "Review the staged changes for security issues. Output only PASS or FAIL with explanation." \
  --output-format stream-json
```

---

## Permission Management

### Configuration Methods

1. **Interactive** — Select "Always allow" during sessions
2. **Command** — Use `/permissions` to manage allowlist
3. **Manual** — Edit `.claude/settings.json` or `~/.claude.json`
4. **CLI flag** — `--allowedTools` for session-specific permissions

### Settings File Example

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git *)",
      "Read",
      "Write"
    ],
    "deny": [
      "Bash(rm -rf *)"
    ]
  }
}
```

---

## Troubleshooting & Course Correction

### Interrupt and Redirect

- **Escape** — Interrupt current operation, preserve context
- **Double Escape** — Edit previous prompts, explore alternatives

### Common Corrections

```
"Stop. Let's take a different approach. Instead of modifying the existing class, create a new service."

"Undo those changes and try again without using any external libraries."

"That's not quite right. The function should return a Promise, not use callbacks."
```

### Ask for Confirmation

```
"Before implementing, explain your plan and wait for my approval."

"After each file change, pause and show me what you modified."
```

---

## Quick Reference

### Extended Thinking Keywords

| Keyword | Use Case |
|---------|----------|
| `think` | Standard problems |
| `think hard` | Complex logic |
| `think harder` | Architectural decisions |
| `ultrathink` | Critical, high-stakes changes |

### Essential Commands

| Command | Purpose |
|---------|---------|
| `/clear` | Reset conversation context |
| `/permissions` | Manage tool allowlist |
| `/help` | Show available commands |
| `#` | Add to CLAUDE.md |

### File Locations

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project instructions |
| `.claude/settings.json` | Project settings |
| `.claude/commands/` | Custom slash commands |
| `~/.claude/CLAUDE.md` | Global instructions |
| `~/.claude/commands/` | Personal commands |

---

## Sources

- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices) — Anthropic
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — Anthropic
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — Anthropic
- [Inside the Development Workflow of Claude Code's Creator](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/) — InfoQ
- [GitHub: anthropics/claude-code](https://github.com/anthropics/claude-code) — Official Repository
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code) — Community Resources
