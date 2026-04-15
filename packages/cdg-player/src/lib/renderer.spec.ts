import { createRenderer } from './renderer.js';

describe('renderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders on main thread and clears when keyColor is set', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 216;

    const clearRect = vi.fn();
    const drawImage = vi.fn();

    const ctx = {
      clearRect,
      drawImage,
    } as unknown as CanvasRenderingContext2D;

    const renderer = createRenderer({
      mode: 'main-thread',
      canvas,
      ctx,
    });

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 300;
    sourceCanvas.height = 216;

    const imageData = {
      data: new Uint8ClampedArray(300 * 216 * 4),
      width: 300,
      height: 216,
    } as unknown as ImageData;

    renderer.render({
      renderContext: {
        canvas: sourceCanvas,
        imageData,
        keyColor: 2,
      },
    });

    expect(clearRect).toHaveBeenCalledWith(0, 0, 300, 216);
    expect(drawImage).toHaveBeenCalledOnce();

    renderer.dispose();
  });

  it('throws in worker mode when Worker is unsupported', () => {
    vi.stubGlobal('Worker', undefined);

    const canvas = document.createElement('canvas');
    const ctx = {} as CanvasRenderingContext2D;

    expect(() =>
      createRenderer({
        mode: 'worker',
        canvas,
        ctx,
      }),
    ).toThrow(
      'Worker renderer is unavailable because Worker is not supported.',
    );
  });

  it('throws in worker mode without transferControlToOffscreen support', () => {
    vi.stubGlobal('Worker', class MockWorker {} as unknown as typeof Worker);

    const canvas = document.createElement('canvas');
    const ctx = {} as CanvasRenderingContext2D;

    expect(() =>
      createRenderer({
        mode: 'worker',
        canvas,
        ctx,
      }),
    ).toThrow('Worker renderer requires transferControlToOffscreen support.');
  });

  it('posts worker frame payload and disposes worker resources', () => {
    class MockWorker {
      postMessage = vi.fn();
      terminate = vi.fn();
    }

    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    vi.stubGlobal(
      'OffscreenCanvas',
      class MockOffscreenCanvas {} as unknown as typeof OffscreenCanvas,
    );

    const canvas = document.createElement('canvas') as HTMLCanvasElement & {
      transferControlToOffscreen?: () => OffscreenCanvas;
    };
    canvas.width = 300;
    canvas.height = 216;
    canvas.transferControlToOffscreen = () =>
      ({ width: 300, height: 216 }) as unknown as OffscreenCanvas;

    const ctx = {} as CanvasRenderingContext2D;
    const renderer = createRenderer({ mode: 'worker', canvas, ctx });

    const sourceCanvas = document.createElement('canvas');
    const imageData = {
      data: new Uint8ClampedArray([1, 2, 3, 4]),
      width: 1,
      height: 1,
    } as unknown as ImageData;

    renderer.render({
      renderContext: {
        canvas: sourceCanvas,
        imageData,
        keyColor: null,
      },
    });

    const worker = (renderer as unknown as { worker: MockWorker }).worker;
    expect(worker.postMessage).toHaveBeenCalled();

    renderer.dispose();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('falls back to main-thread renderer when auto worker creation fails', () => {
    class ThrowingWorker {
      constructor() {
        throw new Error('worker init failed');
      }
    }

    vi.stubGlobal('Worker', ThrowingWorker as unknown as typeof Worker);
    vi.stubGlobal(
      'OffscreenCanvas',
      class MockOffscreenCanvas {} as unknown as typeof OffscreenCanvas,
    );

    const canvas = document.createElement('canvas') as HTMLCanvasElement & {
      transferControlToOffscreen?: () => OffscreenCanvas;
    };
    canvas.transferControlToOffscreen = () =>
      ({ width: 300, height: 216 }) as unknown as OffscreenCanvas;

    const drawImage = vi.fn();
    const ctx = {
      clearRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D;

    const renderer = createRenderer({ mode: 'auto', canvas, ctx });

    renderer.render({
      renderContext: {
        canvas: document.createElement('canvas'),
        imageData: {
          data: new Uint8ClampedArray([0, 0, 0, 0]),
          width: 1,
          height: 1,
        } as unknown as ImageData,
        keyColor: null,
      },
    });

    expect(drawImage).toHaveBeenCalledOnce();
  });
});
