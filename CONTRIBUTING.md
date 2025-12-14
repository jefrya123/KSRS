# Contributing

Quick guide for collaborating with Claude and committing frequently.

Prereqs
- Run `npm install` to install dev dependencies.
- Run `npm run prepare` to install Husky Git hooks.

Branching & commits
- Use short-lived branches: `feature/<short-desc>`, `fix/<short-desc>`, or `claude/<id>` for Claude-generated work.
- Commit small, focused changes often. Each PR should be one logical change.
- Use conventional commit messages: `feat:`, `fix:`, `chore:`.

CI & checks
- A GitHub Actions workflow runs lint, typecheck and tests on push/pull_request.
- Pre-commit hooks run `lint-staged` to format and lint staged files.

Reviewing Claude's patches
- Run the tests (`npm run test`) and lint locally before merging.
- If changes are non-obvious, leave a review comment requesting clarification.
