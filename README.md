# CDGPlayer Monorepo

CDGPlayer is a package-first Nx monorepo for browser karaoke playback.

## Status

- Legacy top-level `src/` and legacy `scripts` demo have been removed.
- Active implementation lives in `packages/*` and `apps/demo`.
- Naming is standardized on `@cxing/cdg-*` packages and `Cdg*` symbols.

## Workspace Layout

- `packages/cdg-core`: CD+G parser, instruction model, render context, frame renderer.
- `packages/cdg-loader`: ZIP/file/url input loading, metadata extraction, worker loading path.
- `packages/cdg-player`: Playback orchestration, timeline sync, audio integration, renderer dispatch.
- `packages/cdg-controls`: Framework-agnostic controls bound to player adapter APIs.
- `apps/demo`: Vite demo app consuming package entrypoints.
- `apps/storybook-hub/docs`: publishable MDX documentation source of truth.
- `scripts/ci`: required docs/release/perf readiness checks.

## Prerequisites

- Node.js 20+
- pnpm 10+

## Install

```bash
pnpm install
```

## Common Commands

```bash
pnpm dev             # run demo in dev mode
pnpm start           # serve demo app
pnpm test            # run tests across projects
pnpm typecheck       # run typecheck across projects
pnpm lint            # run lint across projects
pnpm build           # build all active projects
```

## CI Gates

```bash
pnpm run ci:validate # lint + typecheck + docs gate
pnpm run ci:test     # tests for cdg-core/loader/player/controls/demo
pnpm run ci:build    # builds for cdg-core/loader/player/controls/demo
```

## Release

```bash
pnpm run release
```

The release flow uses `pnpm nx release` with synchronized package versioning across `@cxing/cdg-*` libraries.

## Documentation

Start with Storybook Hub docs under [apps/storybook-hub/docs/README.mdx](apps/storybook-hub/docs/README.mdx).
