# Contributing

This file covers repository workflows for contributors and maintainers.

## Prerequisites

- Node.js 20+
- pnpm 10+

## Install

Run dependency install from repository root: pnpm install

## Common Development Commands

- pnpm dev: run demo in development mode
- pnpm dev:framework: run framework demo in development mode
- pnpm storybook:dev: run storybook-web, storybook-react, and storybook-hub together
- pnpm lint: run lint across repository projects
- pnpm typecheck: run typecheck across repository projects
- pnpm test: run tests across repository projects
- pnpm run ci:test:coverage: run covered CI tests and fail if any covered project drops below 90% function coverage or 80% branch coverage
- pnpm build: run builds across configured repository projects

## CI Workflows

Workflows live under [.github/workflows](.github/workflows).

- [ci.yml](.github/workflows/ci.yml): PR validation for lint, typecheck, per-project coverage-gated unit tests, application/package builds, and Storybook static build validation.
- [codeql.yml](.github/workflows/codeql.yml): security scanning.
- [release.yml](.github/workflows/release.yml): release automation through Nx release and publish flow.
- [docs-pages.yml](.github/workflows/docs-pages.yml): documentation site build and GitHub Pages deploy triggered after successful Release workflow completion.

Before opening or updating a pull request, run these checks from repository root:

1. pnpm run ci:validate
2. pnpm run ci:test
3. pnpm run ci:test:coverage
4. pnpm run ci:build
5. pnpm run ci:docs

The coverage gate is enforced per covered project, not on the overall aggregate row in coverage/summary.md. Each covered package or app must stay at or above 90% function coverage and 80% branch coverage.

## Branch Protection

Configure branch protection on master with required checks:

1. Require pull requests before merging.
2. Require status checks to pass before merging.
3. Require branches to be up to date before merging.
4. Require check ci/lint-typecheck.
5. Require check ci/unit-test.
6. Require check ci/test-coverage.
7. Require check ci/build.
8. Require check ci/storybook-build.
9. Require check codeql/analyze.

For solo-maintainer workflows, you can defer stricter options like required reviewers and no-bypass until after initial rollout.

## Release Process

- Local dry-run: pnpm run release:dry-run
- Local release command: pnpm run release

Primary release execution is expected from GitHub Actions via [release.yml](.github/workflows/release.yml).
