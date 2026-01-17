# Architecture Decisions

This is a living document. Update it as you make architectural decisions during implementation.

## Format
For each decision, document:
- **Decision**: What you decided
- **Context**: Why this decision was needed
- **Rationale**: Why you chose this approach over alternatives
- **Consequences**: What this enables or constrains

---

## Decisions

### ADR-001: Layered Architecture for Testability
**Status**: Accepted

**Decision**: Separate extension into three layers:
1. **VSCode Integration Layer** (thin) - extension.ts, WebviewProvider, command handlers
2. **Core Business Logic** (VSCode-independent) - analyzers, data transformers, cache logic
3. **External Dependencies** (injectable) - git operations, LOC counting, file system

**Context**: VSCode extensions are difficult to test because they depend on the VSCode runtime. We need the core analysis logic to be testable without launching VSCode.

**Rationale**:
- Core logic can be unit tested with Vitest (fast, no VSCode needed)
- VSCode integration is thin and tested separately with @vscode/test-electron
- Dependencies can be mocked easily with interfaces
- Follows dependency inversion principle

**Consequences**:
- Core modules MUST NOT import from 'vscode'
- All external dependencies passed via constructor/function parameters
- Slightly more boilerplate for dependency injection
- Much faster test execution and better test coverage

---

(Add new decisions as you implement)
