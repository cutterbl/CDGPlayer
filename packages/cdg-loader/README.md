# @cxing/cdg-loader

Loads browser-supported audio and karaoke inputs (zip/file/url/blob/arrayBuffer) into one normalized track payload.

Use this package when you want a stable pre-player loading contract and metadata extraction.

## Install

```bash
pnpm add @cxing/cdg-loader
```

## Minimal Usage

```ts
import { createLoader } from '@cxing/cdg-loader';

const loader = createLoader();

const loadedTrack = await loader.load({
  input: { kind: 'file', file: selectedFile },
  options: { debug: false },
});

console.log(loadedTrack.trackId);
console.log(loadedTrack.metadata.title, loadedTrack.metadata.artist);
console.log(loadedTrack.audioBuffer, loadedTrack.cdgBytes);
```

## Input Kinds

- `url`
- `file`
- `blob`
- `arrayBuffer`

## Output Shape

`load(...)` returns `LoadedTrack` with:

- `trackId`
- `sourceSummary`
- `audioBuffer` (`ArrayBuffer`)
- `audioMimeType` (`string`)
- `hasGraphics` (`boolean`)
- `cdgBytes` (`Uint8Array | null`)
- `metadata` (`title`, `artist`, `album`)
- `warnings`

## Probe API

Use `probe(...)` to preflight archive structure before full load:

```ts
const probe = await loader.probe({
  input: { kind: 'file', file: selectedFile },
});

console.log(probe.karaokeLikely, probe.audioLikely, probe.discoveredEntries);
```

## Worker Transport

You can use worker-backed loading via `loadInWorker(...)` with automatic fallback behavior handled by `@cxing/cdg-player`.

## Docs

- Loader contract: https://cutterscrossing.com/?path=/docs/documentation-api-loader-contract--docs
- Migration guide: https://cutterscrossing.com/?path=/docs/documentation-migration-guide--docs
