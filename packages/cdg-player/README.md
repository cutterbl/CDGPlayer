# @cxing/cdg-player

High-level CD+G runtime for loading, playback orchestration, audio sync, rendering dispatch, and optional stage video playback.

This is the recommended package for most consuming applications.

## Install

```bash
pnpm add @cxing/cdg-player
```

## Minimal Usage

```ts
import { createPlayer } from '@cxing/cdg-player';

const player = createPlayer({
  options: {
    canvas,
    audio,
    video,
    debug: false,
  },
});

await player.load({
  input: { kind: 'file', file: selectedFile },
});

await player.play();
```

## State + Events

```ts
player.addEventListener('statechange', () => {
  const state = player.getState();
  console.log(state.status, state.currentTimeMs, state.durationMs);
});
```

Player states:

- `idle`
- `loading`
- `ready`
- `playing`
- `paused`
- `error`

## Runtime Controls

```ts
player.pause();
player.stop();
player.seek({ percentage: 50 });
player.setVolume({ value: 0.8 });
player.setTempo({ value: 1.1 });
player.setPitchSemitones({ value: -2 });
```

## Notes

- `setTempo` is the preferred singer-facing speed API.
- `setPlaybackRate` remains available as a compatibility alias.
- Audio-only tracks are supported; playback state and transport remain functional without a graphics stream.
- Video tracks are supported when you provide a `video` element in `options`.
- CDG render and sync operations are conditional on graphics availability.
- Best cross-browser video compatibility comes from MP4 files encoded as H.264 video with AAC audio.
- A container can look supported and still fail decode; the player performs extra runtime checks for video metadata and decoded dimensions.
- Always call `dispose()` on teardown.

## Public Constants And Functions

Only the utility functions below are exported from `@cxing/cdg-player`.

### Utility Functions

- `asMilliseconds({ seconds })`
- `canElementPlayMimeType({ media, mimeType })`

## Docs

- Player contract: https://cutterscrossing.com/?path=/docs/documentation-api-player-contract--docs
- Controls contract: https://cutterscrossing.com/?path=/docs/documentation-api-controls-contract--docs
