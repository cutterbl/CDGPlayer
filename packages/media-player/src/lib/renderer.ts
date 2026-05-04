import type { CdgRenderContext } from '@cxing/media-parser-cdg';

/** Preferred render dispatch mode for frame presentation. */
export type PlayerRenderMode = 'auto' | 'main-thread' | 'worker';

/** Renderer abstraction used by CdgPlayer to present decoded frames. */
export interface CdgRenderer {
  readonly mode: 'main-thread' | 'worker';
  render(args: { renderContext: CdgRenderContext }): void;
  dispose(): void;
}

type WorkerInitMessage = {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
};

type WorkerFrameMessage = {
  type: 'frame';
  width: number;
  height: number;
  pixels: ArrayBuffer;
  clear: boolean;
};

type WorkerDisposeMessage = {
  type: 'dispose';
};

const drawFrameToDisplay = ({
  renderContext,
  displayCanvas,
  displayCtx,
}: {
  renderContext: CdgRenderContext;
  displayCanvas: HTMLCanvasElement;
  displayCtx: CanvasRenderingContext2D;
}): void => {
  if (renderContext.keyColor != null) {
    displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
  }

  displayCtx.drawImage(
    renderContext.canvas,
    0,
    0,
    renderContext.canvas.width,
    renderContext.canvas.height,
    0,
    0,
    displayCanvas.width,
    displayCanvas.height,
  );
};

class MainThreadRenderer implements CdgRenderer {
  readonly mode = 'main-thread' as const;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor({
    canvas,
    ctx,
  }: {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  }) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  render({ renderContext }: { renderContext: CdgRenderContext }): void {
    drawFrameToDisplay({
      renderContext,
      displayCanvas: this.canvas,
      displayCtx: this.ctx,
    });
  }

  dispose(): void {
    // Main-thread renderer has no external resources.
  }
}

class WorkerRenderer implements CdgRenderer {
  readonly mode = 'worker' as const;

  private readonly worker: Worker;

  constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    const transferableCanvas = canvas as HTMLCanvasElement & {
      transferControlToOffscreen?: () => OffscreenCanvas;
    };

    if (typeof Worker !== 'function') {
      throw new Error(
        'Worker renderer is unavailable because Worker is not supported.',
      );
    }

    if (typeof transferableCanvas.transferControlToOffscreen !== 'function') {
      throw new Error(
        'Worker renderer requires transferControlToOffscreen support.',
      );
    }

    this.worker = new Worker(new URL('./render.worker.ts', import.meta.url), {
      type: 'module',
    });

    const offscreenCanvas = transferableCanvas.transferControlToOffscreen();
    const initMessage: WorkerInitMessage = {
      type: 'init',
      canvas: offscreenCanvas,
      width: canvas.width,
      height: canvas.height,
    };

    this.worker.postMessage(initMessage, [offscreenCanvas]);
  }

  render({ renderContext }: { renderContext: CdgRenderContext }): void {
    const pixelCopy = new Uint8ClampedArray(renderContext.imageData.data);
    const frameMessage: WorkerFrameMessage = {
      type: 'frame',
      width: renderContext.imageData.width,
      height: renderContext.imageData.height,
      pixels: pixelCopy.buffer,
      clear: renderContext.keyColor != null,
    };

    this.worker.postMessage(frameMessage, [pixelCopy.buffer]);
  }

  dispose(): void {
    const message: WorkerDisposeMessage = { type: 'dispose' };
    this.worker.postMessage(message);
    this.worker.terminate();
  }
}

const supportsWorkerRenderer = ({
  canvas,
}: {
  canvas: HTMLCanvasElement;
}): boolean => {
  if (typeof Worker !== 'function' || typeof OffscreenCanvas === 'undefined') {
    return false;
  }

  const transferableCanvas = canvas as HTMLCanvasElement & {
    transferControlToOffscreen?: () => OffscreenCanvas;
  };

  return typeof transferableCanvas.transferControlToOffscreen === 'function';
};

/**
 * Creates a renderer for the requested mode, with auto fallback logic.
 */
export const createRenderer = ({
  mode,
  canvas,
  ctx,
}: {
  mode: PlayerRenderMode;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}): CdgRenderer => {
  if (mode === 'main-thread') {
    return new MainThreadRenderer({ canvas, ctx });
  }

  if (mode === 'worker') {
    return new WorkerRenderer({ canvas });
  }

  if (supportsWorkerRenderer({ canvas })) {
    try {
      return new WorkerRenderer({ canvas });
    } catch {
      return new MainThreadRenderer({ canvas, ctx });
    }
  }

  return new MainThreadRenderer({ canvas, ctx });
};
