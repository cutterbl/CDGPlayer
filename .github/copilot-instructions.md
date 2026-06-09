# Copilot Workspace Instructions

## Local Environment

- Operating system: macOS
- Preferred shell: zsh
- `rg` (ripgrep) is not available in this environment

## Terminal Command Guidance

- Use `zsh`-compatible commands and syntax.
- Do not assume `rg` exists.
- For file discovery, use alternatives such as:
  - `find . -type f`
  - `ls -R`
- For text search, use alternatives such as:
  - `grep -R "pattern" .`
  - `grep -Rin "pattern" .`

## Behavior Expectation

- Always adapt command suggestions and scripts to this macOS + zsh setup.
- If a command example would normally use `rg`, replace it with `find`/`grep` equivalents.
- Keep documentation synchronized with code changes. When behavior, public APIs, defaults, or workflows change, update the relevant README/docs files in the same change.

## Git Commit Requests

- **Never commit directly to `master`.** All commits must go on a branch. If not already on a branch, create one before staging or committing anything.
- When the user asks to "stage and commit", stage all current changes by default unless the user explicitly scopes which changes to include, and create a commit using Conventional Commits format.
- The commit subject must be sentence-case and match repository conventions (for example: `feat(core): Add pitch bend support` or `chore: Update lint configuration`).
- Do not use vague commit subjects; choose the type/scope/subject based on the actual staged changes.

## "Update Everything" Dependency Workflow

When the user asks to "update everything" (or equivalent phrasing for workspace-wide dependency updates), run this process end-to-end:

1. Create and switch to a new branch named `fix/depUpdates[MMDDYY]` before making changes.
2. Upgrade dependencies using latest versions first; only regress specific packages if necessary after confirming a real compatibility failure.
3. Upgrade in this order:
  - Nx first using Nx-recommended CLI migration flow.
  - Storybook second using Storybook-recommended CLI upgrade flow.
  - Remaining workspace dependencies/devDependencies/peerDependencies afterward (to include all `package.json`s).
4. Apply any required config or script updates needed to keep CI/CD behavior intact.
5. Run full validation checks and ensure they pass:
  - typecheck
  - lint
  - build
  - test
  - coverage threshold checks
6. Clean up temporary artifacts created during the upgrade process.
7. Before staging/committing, explicitly ask the user to confirm they verified the final result.
8. Only after user confirmation, stage and commit all intended changes using a Conventional Commit message.

# Project Guidelines

## Code Style

- Prefer TypeScript for shipped application and package code.
- Never use `any` in TypeScript. Use precise types, generics, discriminated unions, or `unknown` with narrowing.
- Use modern ECMAScript patterns already established in this repo: ESM modules, async/await, named-argument objects, and standard web platform APIs.
- Keep public APIs, state, and event payloads explicitly typed.
- Avoid reintroducing legacy patterns when a modern TypeScript or browser-native approach already exists in the codebase.

## CSS Guidelines

- Prefer CSS features that are baseline for 2024, including nested CSS and CSS layers.
- Use nested selectors to keep component styling scoped and maintainable.
- Prefer CSS Modules (`.module.css`) for component and interface styling.
- Avoid new global styles and inline styles except for one-off prototyping, CSS variables, or classes intentionally shared across components.
- When touching existing global styles, migrate incrementally toward CSS Modules instead of broad rewrites.
- Shared/global exceptions should be limited to:
  - Design tokens and theme variables (for example, `:root` custom properties).
  - Reset/normalize/base element styles.
  - App-shell layout utilities used across many pages (for example, page container and spacing utility classes).
  - Third-party integration hooks where global selectors are required by the library.

## Architecture

- This repository is an Nx monorepo managed with `pnpm` workspaces.
- Reusable libraries live under `packages/cdg-*`.
- Runnable apps live under `apps/`, including `demo`, `framework-demo`, and the Storybook apps.
- Keep package boundaries intact between `packages/cdg-*`, demo apps, and Storybook apps.
- Make focused changes; avoid broad refactors unless the task requires them.
- Prefer clear segmentation: keep constants and pure utilities in dedicated files instead of mixing them into large orchestration modules.
- Prefer package/module boundaries that separate contracts, capabilities/utilities, and runtime orchestration when expanding scope.
- Keep implementation guides and example stories aligned with the code they document.
- Framework-agnostic implementation guidance must align with `apps/demo`.
- React implementation guidance must align with `apps/framework-demo`.

## Public Exports

- When adding reusable developer-facing resources (types, constants, utilities, helpers), consider promoting them to public exports.
- Validate public export candidates before exposing them: stable naming, tests, documentation, and compatibility impact.
- Prefer exporting from package entrypoints (`index.ts` / `exports`) intentionally; avoid accidental deep-import-only APIs.

## Monorepo Workflow

- Use `pnpm` for installs and script execution; do not switch to `npm` or `yarn` for workspace tasks.
- Prefer `pnpm nx run <project>:<target>` for project-scoped work.
- Prefer `pnpm nx run-many -t <target>` when validating the same target across multiple projects.
- Use root `pnpm run ...` scripts when the repository already defines the canonical workflow, especially for CI-oriented commands and Storybook orchestration.
- Prefer the smallest relevant Nx target for validation before running broad workspace commands.
- When changing a package or app, check whether there is a matching `build`, `test`, `lint`, or `typecheck` target before using broader commands.

## Documentation

- Any code change must include accompanying documentation updates.
- Acceptable documentation updates include one or more of: Storybook docs, package/app README updates, or inline JSDoc for the touched API/logic.
- For exported APIs, prefer JSDoc updates in addition to user-facing docs when behavior/contracts change.
- Update Storybook documentation when public behavior, integration flow, or architecture guidance changes.
- Keep runtime contracts in `apps/storybook-hub/docs`.
- Keep framework-specific implementation guides next to their example stories in `apps/storybook-web/stories` and `apps/storybook-react/stories`.
- Storybook contribution guidance is pull-request oriented and should not describe release workflow.

## Build and Test

- Any code change must include corresponding test updates or additions.
- Run the smallest relevant validation for the change when possible.
- For documentation changes, prefer `pnpm run ci:docs` and the relevant Storybook build.
- For broader changes, use the repo validation commands already documented in Storybook contribution guidance.
- Keep coverage thresholds unchanged, but aim to stay at least 5 percentage points above the enforced minima when practical (currently branch >= 85% and functions >= 95%).
- Do not land code changes that reduce coverage below enforced thresholds; update/add tests to maintain threshold compliance.
