export type { ByteLike, AnimationFrameHandle } from '@cxing/media-core';

/**
 * RGB tuple (0-255 each channel).
 */
export type CdgRgb = readonly [number, number, number];

/**
 * Rendering context contract used by CD+G instructions and player runtime.
 */
export interface CdgRenderContext {
  hOffset: number;
  vOffset: number;
  keyColor: number | null;
  backgroundColor: number | null;
  borderColor: number | null;
  memoryColor: number | null;
  clut: CdgRgb[];
  pixels: number[];
  buffer: number[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
  setPixel(args: { x: number; y: number; colorIndex: number }): void;
  getPixel(args: { x: number; y: number }): number;
  setCLUTEntry(args: { index: number; r: number; g: number; b: number }): void;
  reset(): void;
  renderFrame(): void;
}

/**
 * Minimal instruction execution contract.
 */
export interface CdgInstructionLike {
  execute(context: CdgRenderContext): void;
}

/**
 * Construction options for the low-level CDGPlayer.
 */
export interface CdgPlayerOptions {
  contextOptions?: Partial<CdgContextOptions>;
  context?: CdgRenderContext;
  afterRender?: (context: CdgRenderContext) => void;
}

/**
 * Canvas/context construction settings for CDGContext.
 */
export interface CdgContextOptions {
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
}
