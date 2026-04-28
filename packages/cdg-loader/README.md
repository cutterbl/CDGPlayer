# @cxing/cdg-loader

Loads browser-supported media and karaoke inputs (zip/file/url/blob/arrayBuffer) into one normalized track payload.

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
console.log(loadedTrack.mediaKind, loadedTrack.mediaMimeType);
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
- `mediaKind` (`'audio' | 'video'`)
- `mediaMimeType` (`string`)
- `audioMimeType` (`string`)
- `hasGraphics` (`boolean`)
- `cdgBytes` (`Uint8Array | null`)
- `metadata` (`title`, `artist`, `album`)
- `warnings`

`audioMimeType` is deprecated and retained for backward compatibility. Prefer `mediaKind` and `mediaMimeType` in new code.

## Browser Codec Support

- Recommended for broad compatibility: MP4 with H.264 video and AAC audio.
- WebM is commonly supported in Chrome and Firefox, with more limited Safari support depending on codec details.
- AVI, MOV, MKV, and similar containers are best-effort only; actual browser support depends on the embedded codecs, not just the file extension.
- The loader performs browser capability checks, but final decode validation for video happens in `@cxing/cdg-player`.

## Probe API

Use `probe(...)` to preflight archive structure before full load:

```ts
const probe = await loader.probe({
  input: { kind: 'file', file: selectedFile },
});

console.log(probe.karaokeLikely, probe.audioLikely, probe.discoveredEntries);
```

## Public Constants And Functions

All items below are exported from `@cxing/cdg-loader` and supported for direct developer use.

### Loader Creation And Transport

- `createLoader({ debug? })`: creates a `CdgLoader` instance.
- `loadInWorker({ input, options? })`: loads input through worker transport.
- `CdgLoader#load({ input, options? })`: loads and normalizes media payload.
- `CdgLoader#probe({ input, options? })`: probes likely karaoke/media entries without full load.
- `CdgLoader#cancel({ requestId })`: cancels one in-flight request.
- `CdgLoader#dispose()`: aborts all in-flight requests and clears internal state.

### Media Constants

- `SUPPORTED_AUDIO_EXTENSIONS`: readonly tuple of recognized audio extensions.
- `SUPPORTED_VIDEO_EXTENSIONS`: readonly tuple of recognized video extensions.
- `SUPPORTED_AUDIO_EXTENSION_SET`: `Set<string>` for quick runtime membership checks.
- `SUPPORTED_VIDEO_EXTENSION_SET`: `Set<string>` for quick runtime membership checks.

### Public Utility Functions

- `extensionFromName({ name })`: returns lowercase extension or `null`.
- `baseNameFromPath({ name })`: strips path segments and returns base file name.
- `stemFromName({ name })`: returns file name without extension.
- `inferMimeTypeFromExtension({ extension, kind })`: maps extension/kind to best-effort MIME.
- `classifyMediaKind({ mimeType?, extension })`: classifies as `'audio'`, `'video'`, or `null`.
- `isLikelySupportedMedia({ name, mimeType? })`: returns whether file appears supported.
- `canBrowserPlayMedia({ mimeType, kind })`: checks browser `canPlayType(...)` support signal.
- `fileNameFromInput({ input })`: derives display/source name from loader input.
- `metadataFromName({ name })`: derives fallback metadata from file naming pattern.

### Notes On Utility API Usage

- These helpers are pure except `canBrowserPlayMedia(...)`, which depends on browser DOM availability.
- `classifyMediaKind(...)` uses MIME first and extension fallback second.
- `inferMimeTypeFromExtension(...)` is best-effort and should be paired with runtime decode validation in player.

## Worker Transport

You can use worker-backed loading via `loadInWorker(...)` with automatic fallback behavior handled by `@cxing/cdg-player`.

## Docs

- Loader contract: https://cutterscrossing.com/?path=/docs/documentation-api-loader-contract--docs
- Migration guide: https://cutterscrossing.com/?path=/docs/documentation-migration-guide--docs
