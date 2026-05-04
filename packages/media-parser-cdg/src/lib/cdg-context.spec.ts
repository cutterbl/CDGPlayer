import { CDGContext } from './cdg-context.js';
import { HEIGHT, WIDTH } from './constants.js';

describe('CDGContext', () => {
  const createBaseContext = (): {
    ctx: CanvasRenderingContext2D;
    imageData: ImageData;
    canvas: HTMLCanvasElement;
  } => {
    const imageData = {
      data: new Uint8ClampedArray(WIDTH * HEIGHT * 4),
      width: WIDTH,
      height: HEIGHT,
    } as ImageData;

    const ctx = {
      imageSmoothingEnabled: true,
      createImageData: vi.fn(() => imageData),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const canvas = {
      width: WIDTH,
      height: HEIGHT,
      getContext: vi.fn(() => ctx),
    } as unknown as HTMLCanvasElement;

    return { ctx, imageData, canvas };
  };

  it('uses provided constructor options and supports pixel/clut helpers', () => {
    const { canvas, ctx, imageData } = createBaseContext();
    const context = new CDGContext({ canvas, ctx, imageData });

    context.setCLUTEntry({ index: 2, r: 1, g: 2, b: 3 });
    context.setPixel({ x: 4, y: 5, colorIndex: 2 });

    expect(context.getPixel({ x: 4, y: 5 })).toBe(2);
    expect(context.clut[2]).toEqual([17, 34, 51]);
  });

  it('reset clears offsets and pixel memory', () => {
    const { canvas, ctx, imageData } = createBaseContext();
    const context = new CDGContext({ canvas, ctx, imageData });

    context.hOffset = 3;
    context.vOffset = 7;
    context.keyColor = 5;
    context.backgroundColor = 6;
    context.borderColor = 2;
    context.memoryColor = 9;
    context.pixels.fill(4);

    context.reset();

    expect(context.hOffset).toBe(0);
    expect(context.vOffset).toBe(0);
    expect(context.keyColor).toBeNull();
    expect(context.backgroundColor).toBeNull();
    expect(context.borderColor).toBeNull();
    expect(context.memoryColor).toBeNull();
    expect(context.pixels[0]).toBe(0);
  });

  it('generateImageData applies offsets and key color alpha', () => {
    const { canvas, ctx, imageData } = createBaseContext();
    const context = new CDGContext({ canvas, ctx, imageData });

    context.clut[3] = [10, 20, 30];
    context.clut[4] = [40, 50, 60];
    context.keyColor = 4;

    context.pixels[0] = 3;
    context.pixels[WIDTH - 1 + (HEIGHT - 1) * WIDTH] = 4;

    context.hOffset = 1;
    context.vOffset = 1;

    const generated = context.generateImageData();

    const topLeft = 0;
    expect(generated.data[topLeft]).toBe(40);
    expect(generated.data[topLeft + 1]).toBe(50);
    expect(generated.data[topLeft + 2]).toBe(60);
    expect(generated.data[topLeft + 3]).toBe(0);

    const shiftedOffset = 4 * (1 + WIDTH);
    expect(generated.data[shiftedOffset]).toBe(10);
    expect(generated.data[shiftedOffset + 1]).toBe(20);
    expect(generated.data[shiftedOffset + 2]).toBe(30);
    expect(generated.data[shiftedOffset + 3]).toBe(255);
  });

  it('renderFrame flushes generated image data to the canvas context', () => {
    const { canvas, ctx, imageData } = createBaseContext();
    const context = new CDGContext({ canvas, ctx, imageData });

    context.renderFrame();

    expect(ctx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
  });

  it('createCanvas builds a canvas using document.createElement', () => {
    const createElementSpy = vi.fn(() => ({ width: 0, height: 0 }));
    vi.stubGlobal('document', {
      createElement: createElementSpy,
    });

    const { canvas, ctx, imageData } = createBaseContext();
    const context = new CDGContext({ canvas, ctx, imageData });

    const nextCanvas = context.createCanvas({ width: 123, height: 45 });

    expect(createElementSpy).toHaveBeenCalledWith('canvas');
    expect(nextCanvas.width).toBe(123);
    expect(nextCanvas.height).toBe(45);
  });

  it('createCanvasContext configures smoothing and throws on missing 2d context', () => {
    const { canvas, ctx, imageData } = createBaseContext();
    const context = new CDGContext({ canvas, ctx, imageData });

    const withContext = {
      width: WIDTH,
      height: HEIGHT,
      getContext: vi.fn(() => ({ imageSmoothingEnabled: true })),
    } as unknown as HTMLCanvasElement;

    const created = context.createCanvasContext({ canvas: withContext });
    expect(created.imageSmoothingEnabled).toBe(false);

    const withoutContext = {
      width: WIDTH,
      height: HEIGHT,
      getContext: vi.fn(() => null),
    } as unknown as HTMLCanvasElement;

    expect(() =>
      context.createCanvasContext({ canvas: withoutContext }),
    ).toThrow('Unable to create 2d canvas context for CDGContext.');
  });

  it('createImageData delegates to ctx.createImageData with explicit dimensions', () => {
    const { canvas, ctx, imageData } = createBaseContext();
    const context = new CDGContext({ canvas, ctx, imageData });

    context.createImageData({ canvas, ctx, width: 77, height: 66 });

    expect(ctx.createImageData).toHaveBeenCalledWith(77, 66);
  });
});
