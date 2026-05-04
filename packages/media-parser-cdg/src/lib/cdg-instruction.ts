import {
  CDG_BORDER_PRESET,
  CDG_DATA,
  CDG_LOAD_CLUT_HI,
  CDG_LOAD_CLUT_LOW,
  CDG_MEMORY_PRESET,
  CDG_NOOP,
  CDG_SCROLL_COPY,
  CDG_SCROLL_DOWN,
  CDG_SCROLL_LEFT,
  CDG_SCROLL_NONE,
  CDG_SCROLL_PRESET,
  CDG_SCROLL_RIGHT,
  CDG_SCROLL_UP,
  CDG_SET_KEY_COLOR,
  CDG_TILE_BLOCK,
  CDG_TILE_BLOCK_XOR,
  DISPLAY_BOUNDS,
  HEIGHT,
  PACKET_SIZE,
  TILE_HEIGHT,
  TILE_WIDTH,
  WIDTH,
} from './constants.js';
import { createScopedLogger } from '@cxing/logger';
import type { ByteLike, CdgRenderContext } from './types.js';

const logger = createScopedLogger({ scope: 'cdg-core', debug: false });

/**
 * Safe indexed byte accessor with zero fallback.
 */
const byteAt = ({ bytes, index }: { bytes: ByteLike; index: number }): number =>
  bytes[index] ?? 0;

/**
 * Copies a fixed-size byte window from packet data.
 */
const copyWindow = ({
  bytes,
  start,
  length,
}: {
  bytes: ByteLike;
  start: number;
  length: number;
}): number[] => {
  const copied: number[] = [];
  for (let i = 0; i < length; i += 1) {
    copied.push(byteAt({ bytes, index: start + i }));
  }
  return copied;
};

/**
 * Base CD+G instruction implementation.
 */
export class CDGInstruction {
  static instruction = '';
  static opcode: number | null = null;

  readonly bytes: number[];

  get instruction(): string {
    return (this.constructor as typeof CDGInstruction).instruction;
  }

  get opcode(): number | null {
    return (this.constructor as typeof CDGInstruction).opcode;
  }

  /**
   * Creates instruction payload from packet bytes.
   */
  constructor({ bytes, offset = 0 }: { bytes: ByteLike; offset?: number }) {
    this.bytes = copyWindow({ bytes, start: offset, length: PACKET_SIZE });
  }

  /**
   * Executes the instruction against a render context.
   */
  execute(context: CdgRenderContext): void {
    void context;
    // Implemented by concrete instructions.
  }

  /**
   * Returns packet bytes as hex string for diagnostics.
   */
  bytecodeToString(): string {
    return this.bytes
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Returns optional instruction-specific details string.
   */
  detailsToString(): string {
    return '';
  }

  /**
   * Returns human-readable instruction label.
   */
  toString(): string {
    return this.instruction;
  }
}

/** No-op instruction (no state change). */
export class CDGNoopInstruction extends CDGInstruction {
  static override instruction = 'No-op';
  static override opcode = CDG_NOOP;
}

/** Resets memory/background color and clears pixel memory. */
export class CDGMemoryPresetInstruction extends CDGInstruction {
  static override instruction = 'Memory Preset';
  static override opcode = CDG_MEMORY_PRESET;

  readonly color: number;
  readonly repeat: number;

  constructor(args: { bytes: ByteLike; offset?: number }) {
    super(args);
    const offset = args.offset ?? 0;
    const doff = offset + CDG_DATA;
    this.color = byteAt({ bytes: args.bytes, index: doff }) & 0x0f;
    this.repeat = byteAt({ bytes: args.bytes, index: doff + 1 }) & 0x0f;
  }

  override execute(context: CdgRenderContext): void {
    context.memoryColor = this.color;
    context.backgroundColor = this.color;
    context.pixels.fill(this.color);
  }
}

/** Fills outer border region with one color index. */
export class CDGBorderPresetInstruction extends CDGInstruction {
  static override instruction = 'Border Preset';
  static override opcode = CDG_BORDER_PRESET;

  readonly color: number;

  constructor(args: { bytes: ByteLike; offset?: number }) {
    super(args);
    const offset = args.offset ?? 0;
    this.color = byteAt({ bytes: args.bytes, index: offset + CDG_DATA }) & 0x0f;
  }

  override execute(context: CdgRenderContext): void {
    context.borderColor = this.color;
    context.backgroundColor = this.color;
    const [left, top, right, bottom] = DISPLAY_BOUNDS;

    for (let x = 0; x < WIDTH; x += 1) {
      for (let y = 0; y < top; y += 1) {
        context.setPixel({ x, y, colorIndex: this.color });
      }
      for (let y = bottom + 1; y < HEIGHT; y += 1) {
        context.setPixel({ x, y, colorIndex: this.color });
      }
    }

    for (let y = top; y <= bottom; y += 1) {
      for (let x = 0; x < left; x += 1) {
        context.setPixel({ x, y, colorIndex: this.color });
      }
      for (let x = right + 1; x < WIDTH; x += 1) {
        context.setPixel({ x, y, colorIndex: this.color });
      }
    }
  }
}

/** Draws a 6x12 tile block using 2-color bitmap data. */
export class CDGTileBlockInstruction extends CDGInstruction {
  static override instruction = 'Tile Block';
  static override opcode = CDG_TILE_BLOCK;

  readonly colors: readonly [number, number];
  readonly row: number;
  readonly column: number;
  readonly pixels: number[];

  constructor(args: { bytes: ByteLike; offset?: number }) {
    super(args);
    const offset = args.offset ?? 0;
    const doff = offset + CDG_DATA;
    this.colors = [
      byteAt({ bytes: args.bytes, index: doff }) & 0x0f,
      byteAt({ bytes: args.bytes, index: doff + 1 }) & 0x0f,
    ];
    this.row = byteAt({ bytes: args.bytes, index: doff + 2 }) & 0x1f;
    this.column = byteAt({ bytes: args.bytes, index: doff + 3 }) & 0x3f;
    this.pixels = copyWindow({
      bytes: args.bytes,
      start: doff + 4,
      length: TILE_HEIGHT,
    });
  }

  override execute(context: CdgRenderContext): void {
    const x = this.column * TILE_WIDTH;
    const y = this.row * TILE_HEIGHT;

    if (x + TILE_WIDTH > WIDTH || y + TILE_HEIGHT > HEIGHT) {
      logger.warn({
        message: `TileBlock out of bounds (${this.row}, ${this.column})`,
      });
      return;
    }

    for (let i = 0; i < TILE_HEIGHT; i += 1) {
      const curbyte = this.pixels[i] ?? 0;
      for (let j = 0; j < TILE_WIDTH; j += 1) {
        const color = this.colors[(curbyte >> (5 - j)) & 0x01] ?? 0;
        this.op({ context, x: x + j, y: y + i, color });
      }
    }
  }

  /**
   * Pixel write operation used by tile block variants.
   */
  op({
    context,
    x,
    y,
    color,
  }: {
    context: CdgRenderContext;
    x: number;
    y: number;
    color: number;
  }): void {
    context.setPixel({ x, y, colorIndex: color });
  }
}

/** Draws a 6x12 tile block using XOR blending mode. */
export class CDGTileBlockXORInstruction extends CDGTileBlockInstruction {
  static override instruction = 'Tile Block (XOR)';
  static override opcode = CDG_TILE_BLOCK_XOR;

  override op({
    context,
    x,
    y,
    color,
  }: {
    context: CdgRenderContext;
    x: number;
    y: number;
    color: number;
  }): void {
    context.setPixel({ x, y, colorIndex: context.getPixel({ x, y }) ^ color });
  }
}

/** Scrolls display using preset fill color for revealed pixels. */
export class CDGScrollPresetInstruction extends CDGInstruction {
  static override instruction = 'Scroll Preset';
  static override opcode = CDG_SCROLL_PRESET;

  readonly color: number;
  readonly hCmd: number;
  readonly hOffset: number;
  readonly vCmd: number;
  readonly vOffset: number;

  constructor(args: { bytes: ByteLike; offset?: number }) {
    super(args);
    const offset = args.offset ?? 0;
    const doff = offset + CDG_DATA;
    this.color = byteAt({ bytes: args.bytes, index: doff }) & 0x0f;

    const hScroll = byteAt({ bytes: args.bytes, index: doff + 1 }) & 0x3f;
    this.hCmd = (hScroll & 0x30) >> 4;
    this.hOffset = hScroll & 0x07;

    const vScroll = byteAt({ bytes: args.bytes, index: doff + 2 }) & 0x3f;
    this.vCmd = (vScroll & 0x30) >> 4;
    this.vOffset = vScroll & 0x0f;
  }

  override execute(context: CdgRenderContext): void {
    context.backgroundColor = this.color;
    context.hOffset = Math.min(this.hOffset, TILE_WIDTH - 1);
    context.vOffset = Math.min(this.vOffset, TILE_HEIGHT - 1);

    let hScroll = 0;
    switch (this.hCmd) {
      case CDG_SCROLL_RIGHT:
        hScroll = TILE_WIDTH;
        break;
      case CDG_SCROLL_LEFT:
        hScroll = -TILE_WIDTH;
        break;
      case CDG_SCROLL_NONE:
      default:
        break;
    }

    let vScroll = 0;
    switch (this.hCmd) {
      case CDG_SCROLL_DOWN:
        vScroll = TILE_HEIGHT;
        break;
      case CDG_SCROLL_UP:
        vScroll = -TILE_HEIGHT;
        break;
      case CDG_SCROLL_NONE:
      default:
        break;
    }

    if (!hScroll && !vScroll) {
      return;
    }

    for (let x = 0; x < WIDTH; x += 1) {
      for (let y = 0; y < HEIGHT; y += 1) {
        context.buffer[x + y * WIDTH] = this.getPixel({
          context,
          offx: x + hScroll,
          offy: y + vScroll,
        });
      }
    }

    [context.pixels, context.buffer] = [context.buffer, context.pixels];
  }

  /**
   * Resolves source pixel for scroll operations.
   */
  getPixel({
    context,
    offx,
    offy,
  }: {
    context: CdgRenderContext;
    offx: number;
    offy: number;
  }): number {
    if (offx > 0 && offx < WIDTH && offy > 0 && offy < HEIGHT) {
      return context.pixels[offx + offy * WIDTH] ?? this.color;
    }
    return this.color;
  }
}

/** Scrolls display by wrapping copied source pixels. */
export class CDGScrollCopyInstruction extends CDGScrollPresetInstruction {
  static override instruction = 'Scroll Copy';
  static override opcode = CDG_SCROLL_COPY;

  override getPixel({
    context,
    offx,
    offy,
  }: {
    context: CdgRenderContext;
    offx: number;
    offy: number;
  }): number {
    const normalizedX = (offx + WIDTH) % WIDTH;
    const normalizedY = (offy + HEIGHT) % HEIGHT;
    return context.pixels[normalizedX + normalizedY * WIDTH] ?? 0;
  }
}

/** Sets transparent key color index. */
export class CDGSetKeyColorInstruction extends CDGInstruction {
  static override instruction = 'Set Key Color';
  static override opcode = CDG_SET_KEY_COLOR;

  readonly color: number;

  constructor(args: { bytes: ByteLike; offset?: number }) {
    super(args);
    const offset = args.offset ?? 0;
    this.color = byteAt({ bytes: args.bytes, index: offset + CDG_DATA }) & 0x0f;
  }

  override execute(context: CdgRenderContext): void {
    context.keyColor = this.color;
  }
}

/** Loads lower 8 CLUT entries from packed 4-bit values. */
export class CDGLoadCLUTLowInstruction extends CDGInstruction {
  static override instruction = 'Load CLUT (Low)';
  static override opcode = CDG_LOAD_CLUT_LOW;

  readonly colors: readonly [number, number, number][];

  get clutOffset(): number {
    return 0;
  }

  constructor(args: { bytes: ByteLike; offset?: number }) {
    super(args);
    const offset = args.offset ?? 0;
    const doff = offset + CDG_DATA;
    const nextColors: [number, number, number][] = [];

    for (let i = 0; i < 8; i += 1) {
      const cur = doff + 2 * i;
      const color =
        ((byteAt({ bytes: args.bytes, index: cur }) & 0x3f) << 6) +
        (byteAt({ bytes: args.bytes, index: cur + 1 }) & 0x3f);
      nextColors[i] = [color >> 8, (color & 0xf0) >> 4, color & 0x0f];
    }

    this.colors = nextColors;
  }

  override execute(context: CdgRenderContext): void {
    for (let i = 0; i < 8; i += 1) {
      const [r, g, b] = this.colors[i] ?? [0, 0, 0];
      context.setCLUTEntry({ index: i + this.clutOffset, r, g, b });
    }
  }
}

/** Loads upper 8 CLUT entries from packed 4-bit values. */
export class CDGLoadCLUTHighInstruction extends CDGLoadCLUTLowInstruction {
  static override instruction = 'Load CLUT (High)';
  static override opcode = CDG_LOAD_CLUT_HI;

  override get clutOffset(): number {
    return 8;
  }
}
