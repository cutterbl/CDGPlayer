import { CDGParser } from './cdg-parser.js';
import { PACKET_SIZE } from './constants.js';
import { CDGPlayer } from './cdg-player.js';
import type { CdgRenderContext } from './types.js';

describe('CDGParser', () => {
  it('parses packet-aligned byte streams into instructions', () => {
    const parser = new CDGParser();
    const bytes = new Uint8Array(PACKET_SIZE * 2);

    const instructions = parser.parseInstructions({ bytes });

    expect(instructions).toHaveLength(2);
  });
});

describe('CDGPlayer', () => {
  it('loads packet data asynchronously without changing output shape', async () => {
    const bytes = new Uint8Array(PACKET_SIZE * 3);
    const context = {
      hOffset: 0,
      vOffset: 0,
      keyColor: null,
      backgroundColor: null,
      borderColor: null,
      memoryColor: null,
      clut: [],
      pixels: [],
      buffer: [],
      canvas: {} as HTMLCanvasElement,
      ctx: {} as CanvasRenderingContext2D,
      imageData: {
        data: new Uint8ClampedArray(0),
        width: 0,
        height: 0,
      } as ImageData,
      setPixel: () => {
        return;
      },
      getPixel: () => 0,
      setCLUTEntry: () => {
        return;
      },
      reset: () => {
        return;
      },
      renderFrame: () => {
        return;
      },
    } satisfies CdgRenderContext;

    const player = new CDGPlayer({ context });

    await player.loadAsync({ data: bytes, chunkPackets: 1 });

    expect(player.instructions).toHaveLength(3);
    expect(player.pc).toBe(0);
  });
});
