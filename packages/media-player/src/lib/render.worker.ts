/** Initialization message for render worker canvas bootstrapping. */
type InitMessage = {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
};

/** Frame transfer message carrying RGBA pixel data. */
type FrameMessage = {
  type: 'frame';
  width: number;
  height: number;
  pixels: ArrayBuffer;
  clear: boolean;
};

/** Disposal message requesting worker shutdown. */
type DisposeMessage = {
  type: 'dispose';
};

type WorkerMessage = InitMessage | FrameMessage | DisposeMessage;

let renderCanvas: OffscreenCanvas | null = null;
let renderContext: OffscreenCanvasRenderingContext2D | null = null;

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'init') {
    renderCanvas = message.canvas;
    renderCanvas.width = message.width;
    renderCanvas.height = message.height;

    const context = renderCanvas.getContext('2d');
    if (!context) {
      renderContext = null;
      return;
    }

    context.imageSmoothingEnabled = false;
    renderContext = context;
    return;
  }

  if (message.type === 'frame') {
    if (!renderCanvas || !renderContext) {
      return;
    }

    const pixelData = new Uint8ClampedArray(message.pixels);
    const imageData = new ImageData(pixelData, message.width, message.height);

    if (message.clear) {
      renderContext.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
    }

    renderContext.putImageData(imageData, 0, 0);
    return;
  }

  if (message.type === 'dispose') {
    renderContext = null;
    renderCanvas = null;
    self.close();
  }
});
