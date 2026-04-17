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
- Keep implementation guides and example stories aligned with the code they document.
- Framework-agnostic implementation guidance must align with `apps/demo`.
- React implementation guidance must align with `apps/framework-demo`.

## Monorepo Workflow

- Use `pnpm` for installs and script execution; do not switch to `npm` or `yarn` for workspace tasks.
- Prefer `pnpm nx run <project>:<target>` for project-scoped work.
- Prefer `pnpm nx run-many -t <target>` when validating the same target across multiple projects.
- Use root `pnpm run ...` scripts when the repository already defines the canonical workflow, especially for CI-oriented commands and Storybook orchestration.
- Prefer the smallest relevant Nx target for validation before running broad workspace commands.
- When changing a package or app, check whether there is a matching `build`, `test`, `lint`, or `typecheck` target before using broader commands.

## Documentation

- Update Storybook documentation when public behavior, integration flow, or architecture guidance changes.
- Keep runtime contracts in `apps/storybook-hub/docs`.
- Keep framework-specific implementation guides next to their example stories in `apps/storybook-web/stories` and `apps/storybook-react/stories`.
- Storybook contribution guidance is pull-request oriented and should not describe release workflow.

## Build and Test

- Run the smallest relevant validation for the change when possible.
- For documentation changes, prefer `pnpm run ci:docs` and the relevant Storybook build.
- For broader changes, use the repo validation commands already documented in Storybook contribution guidance.
