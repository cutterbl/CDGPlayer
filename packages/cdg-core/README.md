# @cxing/cdg-core

Low-level CD+G parsing and rendering primitives.

Use this package when you need packet-level control, custom rendering pipelines, or direct instruction execution.

## Install

```bash
pnpm add @cxing/cdg-core
```

## What You Get

- `CDGParser`: turns CD+G packet bytes into instruction objects
- `CDGPlayer`: low-level frame advancement/sync runtime
- `CDGContext`: pixel buffer + palette + canvas rendering context
- constants and types for packet/frame math (`WIDTH`, `HEIGHT`, `PACKET_SIZE`, etc.)

## Quick Start

```ts
import { CDGPlayer, WIDTH, HEIGHT } from '@cxing/cdg-core';

const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;

canvas.width = WIDTH;
canvas.height = HEIGHT;

const player = new CDGPlayer({
  afterRender: () => {
    // Optional hook after each rendered frame.
  },
});

// cdgBytes is a Uint8Array (or any ByteLike)
player.load({ data: cdgBytes });

// When your audio timeline moves, keep CDG in sync.
player.sync({ ms: audio.currentTime * 1000 });
player.play();
```

## Typical Advanced Flow

```ts
import { CDGParser } from '@cxing/cdg-core';

const parser = new CDGParser();
const instructions = parser.parseInstructions({ bytes: cdgBytes });

// inspect instructions, register custom opcodes, etc.
```

## Notes

- `@cxing/cdg-player` is the recommended package for most app integrations.
- `@cxing/cdg-core` is intentionally lower-level and best for custom runtimes/tooling.

## Docs

- Architecture: https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-architecture--docs
- Player contract: https://cutterbl.github.io/CDGPlayer/?path=/docs/documentation-api-player-contract--docs
