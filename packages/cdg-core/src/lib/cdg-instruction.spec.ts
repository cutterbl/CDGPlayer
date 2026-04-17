import {
  CDGBorderPresetInstruction,
  CDGInstruction,
  CDGLoadCLUTHighInstruction,
  CDGLoadCLUTLowInstruction,
  CDGMemoryPresetInstruction,
  CDGScrollCopyInstruction,
  CDGScrollPresetInstruction,
  CDGSetKeyColorInstruction,
  CDGTileBlockInstruction,
  CDGTileBlockXORInstruction,
} from './cdg-instruction.js';
import {
  CDG_BORDER_PRESET,
  CDG_COMMAND,
  CDG_DATA,
  CDG_LOAD_CLUT_HI,
  CDG_LOAD_CLUT_LOW,
  CDG_MEMORY_PRESET,
  CDG_SCROLL_COPY,
  CDG_SCROLL_DOWN,
  CDG_SCROLL_LEFT,
  CDG_SCROLL_RIGHT,
  CDG_SCROLL_PRESET,
  CDG_SET_KEY_COLOR,
  CDG_TILE_BLOCK,
  CDG_TILE_BLOCK_XOR,
  HEIGHT,
  PACKET_SIZE,
  WIDTH,
} from './constants.js';
import type { CdgRenderContext } from './types.js';

const createPacket = ({
  opcode,
  data = [],
}: {
  opcode: number;
  data?: number[];
}): Uint8Array => {
  const bytes = new Uint8Array(PACKET_SIZE);
  bytes[0] = CDG_COMMAND;
  bytes[1] = opcode;

  for (let index = 0; index < data.length; index += 1) {
    bytes[CDG_DATA + index] = data[index] ?? 0;
  }

  return bytes;
};

const createRenderContext = (): CdgRenderContext => {
  const pixels = new Array(WIDTH * HEIGHT).fill(0);
  const buffer = new Array(WIDTH * HEIGHT).fill(0);
  const clut = new Array(16).fill([0, 0, 0]);

  return {
    hOffset: 0,
    vOffset: 0,
    keyColor: null,
    backgroundColor: null,
    borderColor: null,
    memoryColor: null,
    clut,
    pixels,
    buffer,
    canvas: {} as HTMLCanvasElement,
    ctx: {} as CanvasRenderingContext2D,
    imageData: {
      data: new Uint8ClampedArray(0),
      width: 0,
      height: 0,
    } as ImageData,
    setPixel: ({ x, y, colorIndex }) => {
      pixels[x + y * WIDTH] = colorIndex;
    },
    getPixel: ({ x, y }) => pixels[x + y * WIDTH] ?? 0,
    setCLUTEntry: ({ index, r, g, b }) => {
      clut[index] = [r, g, b];
    },
    reset: () => {
      pixels.fill(0);
    },
    renderFrame: () => undefined,
  };
};

describe('CDG instructions', () => {
  it('base instruction exposes bytecode and label helpers', () => {
    const instruction = new CDGInstruction({
      bytes: createPacket({ opcode: CDG_MEMORY_PRESET, data: [0x0a, 0x00] }),
    });

    instruction.execute(createRenderContext());

    expect(instruction.opcode).toBeNull();
    expect(instruction.bytecodeToString().length).toBe(PACKET_SIZE * 2);
    expect(instruction.detailsToString()).toBe('');
    expect(instruction.toString()).toBe('');
  });

  it('pads missing packet bytes with zero values', () => {
    const instruction = new CDGInstruction({
      bytes: new Uint8Array([0x09, 0x01]),
    });

    expect(instruction.bytes).toHaveLength(PACKET_SIZE);
    expect(instruction.bytes[PACKET_SIZE - 1]).toBe(0);
  });

  it('memory preset updates memory and fills all pixels', () => {
    const instruction = new CDGMemoryPresetInstruction({
      bytes: createPacket({ opcode: CDG_MEMORY_PRESET, data: [0x05, 0x01] }),
    });
    const context = createRenderContext();

    instruction.execute(context);

    expect(context.memoryColor).toBe(5);
    expect(context.backgroundColor).toBe(5);
    expect(context.pixels[0]).toBe(5);
    expect(context.pixels[WIDTH * HEIGHT - 1]).toBe(5);
  });

  it('border preset updates border/background colors', () => {
    const instruction = new CDGBorderPresetInstruction({
      bytes: createPacket({ opcode: CDG_BORDER_PRESET, data: [0x03] }),
    });
    const context = createRenderContext();

    instruction.execute(context);

    expect(context.borderColor).toBe(3);
    expect(context.backgroundColor).toBe(3);
    expect(context.pixels[0]).toBe(3);
  });

  it('tile block writes pixel data and xor variant blends with existing pixels', () => {
    const tilePacket = createPacket({
      opcode: CDG_TILE_BLOCK,
      data: [0x02, 0x09, 0x00, 0x00, 0b111111, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    const xorPacket = createPacket({
      opcode: CDG_TILE_BLOCK_XOR,
      data: [0x01, 0x03, 0x00, 0x00, 0b111111, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });

    const drawInstruction = new CDGTileBlockInstruction({ bytes: tilePacket });
    const xorInstruction = new CDGTileBlockXORInstruction({ bytes: xorPacket });
    const context = createRenderContext();

    drawInstruction.execute(context);
    const preXor = context.getPixel({ x: 0, y: 0 });
    xorInstruction.execute(context);
    const postXor = context.getPixel({ x: 0, y: 0 });

    expect(preXor).toBe(9);
    expect(postXor).toBe(9 ^ 3);
  });

  it('tile block warns and skips draw when block is out of bounds', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const instruction = new CDGTileBlockInstruction({
      bytes: createPacket({
        opcode: CDG_TILE_BLOCK,
        data: [0x01, 0x02, 0x1f, 0x3f, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    });

    const context = createRenderContext();
    instruction.execute(context);

    expect(warnSpy).toHaveBeenCalled();
  });

  it('scroll preset and scroll copy resolve source pixels differently', () => {
    const presetInstruction = new CDGScrollPresetInstruction({
      bytes: createPacket({
        opcode: CDG_SCROLL_PRESET,
        data: [0x07, 0x20 | CDG_SCROLL_LEFT, 0x00],
      }),
    });
    const copyInstruction = new CDGScrollCopyInstruction({
      bytes: createPacket({
        opcode: CDG_SCROLL_COPY,
        data: [0x04, 0x20 | CDG_SCROLL_LEFT, 0x00],
      }),
    });

    const context = createRenderContext();
    context.pixels[1 + WIDTH] = 11;

    const presetOutside = presetInstruction.getPixel({
      context,
      offx: -1,
      offy: -1,
    });
    const copyWrapped = copyInstruction.getPixel({ context, offx: 1, offy: 1 });

    presetInstruction.execute(context);

    expect(presetOutside).toBe(7);
    expect(copyWrapped).toBe(11);
    expect(context.backgroundColor).toBe(7);
  });

  it('scroll preset covers no-scroll early return and right/down movement branches', () => {
    const context = createRenderContext();
    context.pixels[6 + WIDTH * 12] = 13;

    const noScroll = new CDGScrollPresetInstruction({
      bytes: createPacket({
        opcode: CDG_SCROLL_PRESET,
        data: [0x05, 0x00, 0x00],
      }),
    });
    const originalPixels = [...context.pixels];

    noScroll.execute(context);
    expect(context.pixels).toEqual(originalPixels);

    const moved = new CDGScrollPresetInstruction({
      bytes: createPacket({
        opcode: CDG_SCROLL_PRESET,
        data: [0x06, 0x20 | CDG_SCROLL_RIGHT, 0x20 | CDG_SCROLL_DOWN],
      }),
    });

    moved.execute(context);

    expect(context.pixels[0]).toBe(13);
    expect(context.backgroundColor).toBe(6);
  });

  it('set key color writes transparency key index', () => {
    const instruction = new CDGSetKeyColorInstruction({
      bytes: createPacket({ opcode: CDG_SET_KEY_COLOR, data: [0x0e] }),
    });
    const context = createRenderContext();

    instruction.execute(context);

    expect(context.keyColor).toBe(14);
  });

  it('clut low/high instructions apply 8-entry color ranges', () => {
    const setClutSpy = vi.fn();
    const context = {
      ...createRenderContext(),
      setCLUTEntry: setClutSpy,
    };

    const low = new CDGLoadCLUTLowInstruction({
      bytes: createPacket({
        opcode: CDG_LOAD_CLUT_LOW,
        data: new Array(16).fill(0x11),
      }),
    });
    const high = new CDGLoadCLUTHighInstruction({
      bytes: createPacket({
        opcode: CDG_LOAD_CLUT_HI,
        data: new Array(16).fill(0x22),
      }),
    });

    low.execute(context);
    high.execute(context);

    expect(setClutSpy).toHaveBeenCalled();
    expect(setClutSpy).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0 }),
    );
    expect(setClutSpy).toHaveBeenCalledWith(
      expect.objectContaining({ index: 8 }),
    );
  });

  it('scroll copy and clut execution use fallback values when source data is sparse', () => {
    const sparseContext = {
      ...createRenderContext(),
      pixels: [],
    } as unknown as CdgRenderContext;

    const copyInstruction = new CDGScrollCopyInstruction({
      bytes: createPacket({
        opcode: CDG_SCROLL_COPY,
        data: [0x04, 0x20 | CDG_SCROLL_LEFT, 0x00],
      }),
    });

    expect(
      copyInstruction.getPixel({ context: sparseContext, offx: 1, offy: 1 }),
    ).toBe(0);

    const setClutSpy = vi.fn();
    const clutContext = {
      ...createRenderContext(),
      setCLUTEntry: setClutSpy,
    };

    const lowInstruction = new CDGLoadCLUTLowInstruction({
      bytes: createPacket({
        opcode: CDG_LOAD_CLUT_LOW,
        data: new Array(16).fill(0),
      }),
    }) as CDGLoadCLUTLowInstruction & {
      colors: Array<[number, number, number]>;
    };

    lowInstruction.colors = [];
    lowInstruction.execute(clutContext);

    expect(setClutSpy).toHaveBeenCalledWith({ index: 0, r: 0, g: 0, b: 0 });
  });
});
