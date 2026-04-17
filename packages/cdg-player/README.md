# @cxing/cdg-player

High-level CD+G runtime for loading, playback orchestration, audio sync, and rendering dispatch.

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
    debug: false,
  },
});

await player.load({
  input: { kind: 'file', file: selectedZip },
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
- Always call `dispose()` on teardown.

## Docs

- Player contract: https://cutterscrossing.com/?path=/docs/documentation-api-player-contract--docs
- Controls contract: https://cutterscrossing.com/?path=/docs/documentation-api-controls-contract--docs
