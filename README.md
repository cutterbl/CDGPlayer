# CDGPlayer Libraries

CDGPlayer provides browser karaoke playback libraries under the `@cxing/cdg-\*` package family.

**BREAKING CHANGE**: The legacy `CDGPlayer` and `CDGControls` monolithic packages have been deprecated and replaced with a modular package architecture. See the [migration guide](https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-migration-guide--docs) for details.

## Packages

- `@cxing/cdg-core`: CD+G parsing, instruction execution, and frame rendering primitives.
- `@cxing/cdg-loader`: zip/file/url loading with normalized track payloads and metadata.
- `@cxing/cdg-player`: high-level playback orchestration, audio sync, and rendering dispatch.
- `@cxing/cdg-controls`: framework-agnostic controls model and UI control builders.
- `@cxing/logger`: standalone scoped logging utility shared across runtime packages.

## Install

Install the packages your app needs.

- Minimal playback setup: `@cxing/cdg-player`
- Loader-only integrations: `@cxing/cdg-loader`
- UI control integrations: `@cxing/cdg-controls`
- Runtime logging integrations: `@cxing/logger`

## Documentation

- [Getting started](https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-getting-started--documentation)
- [Migration guide](https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-migration-guide--docs)
- [Logger contract](https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-api-logger-contract--docs)
- [Loader contract](https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-api-loader-contract--documentation)
- [Player contract](https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-api-player-contract--documentation)
- [Controls contract](https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-api-controls-contract--documentation)
- [Framework-agnostic implementation guide](https://cutterbl.github.io/CDGPlayer/storybook-web/?path=/docs/examples-framework-agnostic-demo-implementation-guide--documentation)
- [React implementation guide](https://cutterbl.github.io/CDGPlayer/storybook-react/?path=/docs/examples-react-demo-implementation-guide--documentation)

## Repository Contribution

Repository setup, CI/CD workflows, and branch protection policy are documented in [CONTRIBUTING.md](CONTRIBUTING.md).
