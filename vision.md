# Vision

## Goal
Expand Repo Stats beyond VS Code with a standalone web experience where a user can paste a repository link and get the same style of analysis without manually cloning the repo first.

The long-term aim is a URL-driven product for exploring open source repositories on demand, while keeping VS Code as a strong local workflow and reusing as much of the analysis and visualization experience as possible across both surfaces.

## Why
- Meet developers where discovery happens: many interesting repos are first encountered on GitHub, GitLab, blog posts, issue threads, and social feeds.
- Remove setup friction: users should not need to clone a repository locally just to inspect its structure and history.
- Reuse what already works: keep shared concepts, metrics, and visual language across the web app and the VS Code extension.
- Grow adoption: a link-first experience makes Repo Stats easier to try, share, and discuss.

## Principles
- Low-friction entry: the primary flow should start from a repository URL.
- Consistent experience: preserve core metrics, terminology, and visual language across surfaces where practical.
- Honest data: if a surface provides approximate, partial, or delayed results, make that explicit.
- Progressive capability: start with useful analysis for public repositories, then deepen fidelity over time.
- Shared foundations: prefer a shared visualization and data model rather than separate products that drift apart.
- Incremental delivery: ship small, usable slices instead of waiting for perfect parity.

## Scope (for now)
- Capture the product direction of a standalone web app that accepts repository links and performs the rest of the workflow for the user.
- Preserve the option of shared components, shared data contracts, and shared visualization logic between web and VS Code.
- Leave room for different implementation strategies, including browser-based, server-assisted, hybrid, or WASM-backed analysis approaches.
- Focus especially on open source repositories that can be analyzed on demand from a link.

## Desired user experience
- A user sees an interesting repository online.
- They paste the repository link into Repo Stats.
- Repo Stats fetches, analyzes, and presents the repository without requiring the user to clone it manually.
- The result feels recognizably like Repo Stats: familiar metrics, charts, treemap views, and repository summaries.

## Non-goals (for now)
- Committing to a browser-only architecture.
- Committing to server-side analysis, client-side analysis, or any specific WASM/tooling choice.
- Promising exact feature parity across web and VS Code from day one.
- Designing the final package layout, monorepo structure, or deployment model.
- Solving every repository-hosting edge case up front.
