## 1.2.0 (2026-04-28)

### 🚀 Features

- Add video support and utility export refinements ([#39](https://github.com/cutterbl/CDGPlayer/pull/39))

### ❤️ Thank You

- Steve 'Cutter' Blades

## 1.1.0 (2026-04-27)

### 🚀 Features

- Add audio-only playback support and refresh workspace tooling ([#38](https://github.com/cutterbl/CDGPlayer/pull/38))

### 🩹 Fixes

- **release:** Update workflow actions ([#35](https://github.com/cutterbl/CDGPlayer/pull/35))

### ❤️ Thank You

- Steve 'Cutter' Blades

## 1.0.1 (2026-04-17)

### 🩹 Fixes

- **release:** Correct CI/CD configuration ([#34](https://github.com/cutterbl/CDGPlayer/pull/34))

### ❤️ Thank You

- Steve 'Cutter' Blades

# 1.0.0 (2026-04-17)

### 🚀 Features

- ⚠️  **monorepo:** migrate CDGPlayer to an Nx package-first workspace ([63351bd](https://github.com/cutterbl/CDGPlayer/commit/63351bd))
- ⚠️  **monorepo:** Migrate CDGPlayer to an Nx package-first workspace ([#31](https://github.com/cutterbl/CDGPlayer/pull/31))
- ⚠️  **monorepo:** Migrate CDGPlayer to an Nx package-first workspace ([#33](https://github.com/cutterbl/CDGPlayer/pull/33))

### ⚠️  Breaking Changes

- **monorepo:** Migrate CDGPlayer to an Nx package-first workspace  ([#33](https://github.com/cutterbl/CDGPlayer/pull/33))
  CDGPlayer now publishes from a package-first Nx workspace.
  The legacy top-level source and docs layout is no longer the published integration
  surface; consumers should use the scoped package entrypoints (@cxing/logger,
  @cxing/cdg-core, @cxing/cdg-loader, @cxing/cdg-player, and @cxing/cdg-controls).
  The release, documentation, CI, and demo/control integration flows have changed since
  v0.1.17 and should be reviewed before upgrading.
- **monorepo:** Migrate CDGPlayer to an Nx package-first workspace  ([#31](https://github.com/cutterbl/CDGPlayer/pull/31))
  CDGPlayer now publishes from a package-first Nx
  workspace.
  The legacy top-level source and docs layout is no longer the
  published integration surface; consumers should use the scoped
  package entrypoints (@cxing/logger, @cxing/cdg-core,
  @cxing/cdg-loader, @cxing/cdg-player, and @cxing/cdg-controls).
  The release, documentation, CI, and demo/control integration
  flows have changed since v0.1.17 and should be reviewed before
  upgrading.
- **monorepo:** migrate CDGPlayer to an Nx package-first workspace  ([63351bd](https://github.com/cutterbl/CDGPlayer/commit/63351bd))
  Removes the legacy top-level src/, scripts demo assets, and /docs documentation tree in favor of package entrypoints and Storybook-composed documentation.
  * chore: Update monorepo tooling and CI workflows
  * fix: Resolve build blockers and rename contribution doc
  * feat: expand test coverage and enforce per-project CI thresholds
  * chore: Stabilize typecheck outputs and test typings
  * feat(controls): Refine key labels and settings panel sizing
  * chore: Add package readmes and refine coverage/docs reporting
  * chore: Tighten lint rules and clean demo/test warnings
  * feat(release)!: Prepare the next major package-first release
  - migrate CDGPlayer to an Nx package-first workspace
  - align package metadata and release automation around scoped
    package entrypoints
  - tighten CI validation, coverage thresholds, docs checks, and
    repository ownership
  - refine framework-agnostic controls and move framework demo
    settings into anchored popovers
  - update demo iconography and supporting Storybook/docs guidance
  BREAKING CHANGE: CDGPlayer now publishes from a package-first Nx
  workspace.
  The legacy top-level source and docs layout is no longer the
  published integration surface; consumers should use the scoped
  package entrypoints (@cxing/logger, @cxing/cdg-core,
  @cxing/cdg-loader, @cxing/cdg-player, and @cxing/cdg-controls).
  The release, documentation, CI, and demo/control integration
  flows have changed since v0.1.17 and should be reviewed before
  upgrading.

### ❤️ Thank You

- Steve 'Cutter' Blades

Changelog
### 0.1.17 (2023-01-05)

### 0.1.16 (2023-01-04)

### 0.1.15 (2023-01-04)

### 0.1.14 (2023-01-04)

### 0.1.13 (2023-01-04)

### 0.1.12 (2023-01-04)

### 0.1.11 (2023-01-04)

### 0.1.10 (2022-05-03)

### 0.1.9 (2021-10-18)

### 0.1.8 (2021-10-18)

### 0.1.7 (2021-10-18)

# Change Log

## Dec 17, 2019 - v0.1.4

* Update dependency libraries to account for security vulnerability
* Update example to account for changes in Chrome (Thanks to [Katherine Winter](https://github.com/KatherineWinter) for code updates)
* Update example to load via file browser (Thanks to [Katherine Winter](https://github.com/KatherineWinter) for code updates)

## Mar 6, 2019 - v0.1.1

* Update dependency libraries to account for security vulnerability
* Update play code for browser changes to autoplay policy (Thanks to Colin Hill for reporting)
* Update package bundling to Babel 7

## Sep 22, 2018 - v0.0.9

* Update underlying soundtouchjs library
* Update internal vars to use 'play' event from soundtouchjs
* Update playback head to use 'play' event from soundtouchjs
* Call video sync from 'play' event from soundtouchjs for smoother output
* Apply playback offset to more closely match the video and audio on timing

## Sep 14, 2018 - v0.0.8

* Change it so that it doesn't display the song tag until after the player is marked as 'loaded'.

## Sep 14, 2018 - v0.0.7

* Create Title Image capability. Documented in the README and added to example.

## Sep 13, 2018 - v0.0.6

* Create Volume slider control and methods
* Update example

## Sep 10, 2018 - v0.0.5

* Read ID3 tag from audio file in zip
* Output 'title' and 'artist' from tag data to the canvas on file load

## Sep 10, 2018 - v0.0.4

* Remove the changeSize() method from the CDGPlayer, and setup automatic ratio on resize via CSS
* Update CDGControls SASS for spacing in the control bar.
* Updated the example

## Sep 7, 2018 - v0.0.3

* Updates to the CDGControls CSS
* Refine the CDGFileLoader, and add capacity for loading zip from file buffer
* Clear player canvas on reload
* Refine player zip handling
* Add methods for controlling volume, and toggling "Mute"