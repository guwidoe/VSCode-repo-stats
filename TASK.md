# Current Task: Build VSCode Repo Stats Extension

## Working Mode
You are both **architect** and **implementer**. Before writing code:
1. Consider the best structure for what you're building
2. Document significant decisions in ARCHITECTURE_DECISIONS.md
3. Refactor existing code if better patterns emerge

**The codebase structure should evolve organically based on implementation needs.**

## Reference Documents
- `SPECIFICATIONS.md` - What to build (requirements)
- `ARCHITECTURE.md` - High-level design guidance
- `ARCHITECTURE_DECISIONS.md` - Your decisions (update as you go)
- `CLAUDE.md` - Coding conventions and validation rules

## Progress Tracker
Update this section as you complete each phase:

- [ ] **Phase 0: Setup** - Run first-time setup commands (see CLAUDE.md "First-Time Setup")
- [ ] **Phase 1: Core Infrastructure** - Extension activation, webview provider, message passing
- [ ] **Phase 2: Git Analysis** - Contributor stats, code frequency
- [ ] **Phase 3: LOC Analysis** - Treemap data generation
- [ ] **Phase 4: Webview Integration** - Wire real data to UI
- [ ] **Phase 5: Polish & Performance** - Caching, error handling, loading states

## Current Phase
**Phase 0: Setup** - Run `npm install`, `cd webview-ui && npm install`, `npm run test:e2e:setup`

## Architectural Decisions Made
(Summary - see ARCHITECTURE_DECISIONS.md for details)
- None yet

## Validation
After EVERY code change:
```bash
npm run validate
```

## Blockers & Notes
(Document issues, questions, or decisions here)

