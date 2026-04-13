import { DISPLAY_PIXELS, HEIGHT, WIDTH } from './constants.js';
import type { CdgContextOptions, CdgRenderContext, CdgRgb } from './types.js';

/**
 * CDGContext stores raster and palette state for the CD+G instruction stream.
 *
 * Process note:
 * - instructions mutate palette and indexed pixels
 * - each render converts indexed data into RGBA in imageData
 * - imageData is then written to the canvas context
 */
export class CDGContext implements CdgRenderContext {
  hOffset = 0;
  vOffset = 0;
  keyColor: number | null = null;
  backgroundColor: number | null = null;
  borderColor: number | null = null;
  memoryColor: number | null = null;

  clut: CdgRgb[] = new Array(16).fill([0, 0, 0]);
  pixels = new Array(DISPLAY_PIXELS).fill(0);
  buffer = new Array(DISPLAY_PIXELS).fill(0);

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;

  /**
   * Creates a CD+G render context with optional injected canvas primitives.
   */
  constructor(options: Partial<CdgContextOptions> = {}) {
    const width = options.width ?? WIDTH;
    const height = options.height ?? HEIGHT;
    const canvas = options.canvas ?? this.createCanvas({ width, height });
    const ctx = options.ctx ?? this.createCanvasContext({ canvas });
    const imageData =
      options.imageData ?? this.createImageData({ canvas, ctx, width, height });

    this.canvas = canvas;
    this.ctx = ctx;
    this.imageData = imageData;
  }

  /**
   * Creates the backing canvas when one is not provided by the caller.
   */
  createCanvas({
    width,
    height,
  }: {
    width: number;
    height: number;
  }): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Resolves a 2D drawing context and applies pixel-art friendly settings.
   */
  createCanvasContext({
    canvas,
  }: {
    canvas: HTMLCanvasElement;
  }): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create 2d canvas context for CDGContext.');
    }
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }

  /**
   * Allocates image data used for indexed-to-RGBA conversion.
   */
  createImageData({
    canvas,
    ctx,
    width = canvas.width,
    height = canvas.height,
  }: {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width?: number;
    height?: number;
  }): ImageData {
    return ctx.createImageData(width, height);
  }

  /**
   * Resets palette offsets and pixel memory to initial frame state.
   */
  reset(): void {
    this.hOffset = 0;
    this.vOffset = 0;
    this.keyColor = null;
    this.backgroundColor = null;
    this.borderColor = null;
    this.memoryColor = null;
    this.pixels.fill(0);
  }

  /**
   * Sets a CLUT entry using 4-bit channel values (expanded to 8-bit RGB).
   */
  setCLUTEntry({
    index,
    r,
    g,
    b,
  }: {
    index: number;
    r: number;
    g: number;
    b: number;
  }): void {
    this.clut[index] = [r * 17, g * 17, b * 17];
  }

  /**
   * Writes an indexed color value to raster memory.
   */
  setPixel({
    x,
    y,
    colorIndex,
  }: {
    x: number;
    y: number;
    colorIndex: number;
  }): void {
    this.pixels[x + y * WIDTH] = colorIndex;
  }

  /**
   * Reads an indexed color value from raster memory.
   */
  getPixel({ x, y }: { x: number; y: number }): number {
    return this.pixels[x + y * WIDTH];
  }

  /**
   * Converts indexed pixel memory into RGBA image data for canvas output.
   */
  generateImageData(): ImageData {
    for (let x = 0; x < WIDTH; x += 1) {
      for (let y = 0; y < HEIGHT; y += 1) {
        const offset = 4 * (x + y * WIDTH);
        const px = (x - this.hOffset + WIDTH) % WIDTH;
        const py = (y - this.vOffset + HEIGHT) % HEIGHT;
        const pixelIndex = px + py * WIDTH;
        const colorIndex = this.pixels[pixelIndex];
        const [r, g, b] = this.clut[colorIndex] ?? [0, 0, 0];

        this.imageData.data[offset] = r;
        this.imageData.data[offset + 1] = g;
        this.imageData.data[offset + 2] = b;
        this.imageData.data[offset + 3] =
          colorIndex === this.keyColor ? 0x00 : 0xff;
      }
    }

    return this.imageData;
  }

  /**
   * Renders the current frame to canvas.
   */
  renderFrame(): void {
    this.ctx.putImageData(this.generateImageData(), 0, 0);
  }
}

export default CDGContext;
