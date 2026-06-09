# CDGPlayer Libraries

<p align="center">
	<img src="./assets/branding/CDGPlayer.svg" alt="CDGPlayer logo" height="250" width="auto" />
</p>

CDGPlayer provides browser karaoke playback libraries under the `@cxing/media-*` package family.

**BREAKING CHANGE**: The legacy `CDGPlayer` and `CDGControls` monolithic packages have been deprecated and replaced with a modular package architecture. See the [migration guide](https://cutterscrossing.com/?path=/docs/documentation-migration-guide--docs) for details.

## Packages

- `@cxing/media-core`: shared media contracts, parser interfaces, and runtime primitives.
- `@cxing/media-parser-cdg`: CD+G parsing, instruction execution, and frame rendering primitives.
- `@cxing/media-loader`: zip/file/url loading with normalized track payloads and metadata.
- `@cxing/media-player`: high-level playback orchestration, audio sync, and rendering dispatch.
- `@cxing/media-playback-controls`: framework-agnostic controls model and UI control builders.
- `@cxing/logger`: standalone scoped logging utility shared across runtime packages.

## Install

Install the packages your app needs.

- Minimal playback setup: `@cxing/media-player`
- Loader-only integrations: `@cxing/media-loader`
- UI control integrations: `@cxing/media-playback-controls`
- Runtime logging integrations: `@cxing/logger`

## Toolchain Baseline

- `pnpm` is pinned via `packageManager` in `package.json`.
- TypeScript baseline is `6.x` for workspace development and CI.

## Documentation

- [Getting started](https://cutterscrossing.com/?path=/docs/documentation-getting-started--documentation)
- [Migration guide](https://cutterscrossing.com/?path=/docs/documentation-migration-guide--docs)
- [Logger contract](https://cutterscrossing.com/?path=/docs/documentation-api-logger-contract--docs)
- [Loader contract](https://cutterscrossing.com/?path=/docs/documentation-api-loader-contract--documentation)
- [Player contract](https://cutterscrossing.com/?path=/docs/documentation-api-player-contract--documentation)
- [Controls contract](https://cutterscrossing.com/?path=/docs/documentation-api-controls-contract--documentation)
- [Framework-agnostic implementation guide](https://cutterscrossing.com/storybook-web/?path=/docs/examples-framework-agnostic-demo-implementation-guide--documentation)
- [React implementation guide](https://cutterscrossing.com/storybook-react/?path=/docs/examples-react-demo-implementation-guide--documentation)

## Repository Contribution

Repository setup, CI/CD workflows, and branch protection policy are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## Storybook Hub Static Build

The composed hub build (`pnpm nx run storybook-hub:site`) embeds the framework-specific Storybooks under `apps/storybook-hub/.dist`.

Storybook 10 emits `index.json` for references. During static hosting, compatibility files (`stories.json`, `metadata.json`) are mirrored from `index.json` for each embedded ref to avoid 404 requests from composition clients that still probe legacy manifest names.
