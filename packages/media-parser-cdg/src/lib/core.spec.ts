import { CDGParser } from './cdg-parser.js';
import { CDG_COMMAND, CDG_DATA, CDG_NOOP, PACKET_SIZE } from './constants.js';
import { CDGInstruction } from './cdg-instruction.js';
import { CDGPlayer } from './cdg-player.js';
import type { CdgRenderContext } from './types.js';

describe('CDGParser', () => {
  it('parses packet-aligned byte streams into instructions', () => {
    const parser = new CDGParser();
    const bytes = new Uint8Array(PACKET_SIZE * 2);

    const instructions = parser.parseInstructions({ bytes });

    expect(instructions).toHaveLength(2);
  });

  it('registers custom instruction constructors and resolves unknown opcodes', () => {
    class CustomInstruction extends CDGInstruction {}

    const parser = new CDGParser();
    parser.registerInstruction({
      opcode: 0x05,
      instructionClass: CustomInstruction,
    });

    const knownBytes = new Uint8Array(PACKET_SIZE);
    knownBytes[0] = CDG_COMMAND;
    knownBytes[1] = 0x05;

    const unknownBytes = new Uint8Array(PACKET_SIZE);
    unknownBytes[0] = CDG_COMMAND;
    unknownBytes[1] = CDG_NOOP + 100;

    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const knownInstruction = parser.parseInstruction({ bytes: knownBytes });
    const unknownInstruction = parser.parseInstruction({ bytes: unknownBytes });

    expect(knownInstruction).toBeInstanceOf(CustomInstruction);
    expect(unknownInstruction.constructor.name).toContain('CDGNoopInstruction');
    expect(warnSpy).toHaveBeenCalled();
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

  it('uses default context creation and timeout-based frame helpers when raf is unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('performance', undefined);
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    const putImageDataSpy = vi.fn();
    const createdCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(
        () =>
          ({
            imageSmoothingEnabled: true,
            createImageData: (width: number, height: number) =>
              ({
                data: new Uint8ClampedArray(width * height * 4),
                width,
                height,
              }) as ImageData,
            putImageData: putImageDataSpy,
          }) as unknown as CanvasRenderingContext2D,
      ),
    };
    const createElementSpy = vi.fn(() => createdCanvas);
    vi.stubGlobal('document', {
      createElement: createElementSpy,
    });

    const executeSpy = vi.fn();
    const player = new CDGPlayer();
    player.instructions = [{ execute: executeSpy }];
    player.pc = 0;

    player.play();
    player.play();
    player.update(1_100);
    player.stop();

    expect(createElementSpy).toHaveBeenCalledWith('canvas');
    expect(player.context.canvas).toBe(createdCanvas);
    expect(executeSpy).toHaveBeenCalled();
    expect(putImageDataSpy).toHaveBeenCalled();
    expect(player.frameId).toBeNull();

    vi.useRealTimers();
  });

  it('yields during chunked async loads and can early-return or skip fast-forward during updates', async () => {
    vi.useFakeTimers();

    const renderFrameSpy = vi.fn();
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
      setPixel: () => undefined,
      getPixel: () => 0,
      setCLUTEntry: () => undefined,
      reset: () => undefined,
      renderFrame: renderFrameSpy,
    } satisfies CdgRenderContext;

    const bytes = new Uint8Array(PACKET_SIZE * 257);
    const player = new CDGPlayer({ context });

    const loadPromise = player.loadAsync({ data: bytes, chunkPackets: 1 });
    await vi.runAllTimersAsync();
    await loadPromise;

    expect(player.instructions).toHaveLength(257);

    player.pc = -1;
    expect(player.update()).toBe(player);

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 123),
    );
    player.pc = 999;
    player.lastSyncPos = 0;
    player.lastTimestamp = 0;
    player.update(0);

    expect(renderFrameSpy).not.toHaveBeenCalled();
    player.stop();

    vi.useRealTimers();
  });

  it('steps and fast-forwards instruction stream, then stops at end', () => {
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
      setPixel: () => undefined,
      getPixel: () => 0,
      setCLUTEntry: () => undefined,
      reset: () => undefined,
      renderFrame: () => undefined,
    } satisfies CdgRenderContext;

    const player = new CDGPlayer({ context });
    const executeSpy = vi.fn();
    player.instructions = [
      { execute: executeSpy },
      { execute: executeSpy },
      { execute: executeSpy },
    ];
    player.pc = 0;

    player.step();
    player.fastForward({ count: 2 });
    player.step();

    expect(executeSpy).toHaveBeenCalledTimes(3);
    expect(player.pc).toBe(-1);
  });

  it('sync/play/update/stop maintain timeline state using raf hooks', () => {
    const requestFrameSpy = vi
      .fn<(cb: FrameRequestCallback) => number>()
      .mockImplementation(() => 42);
    const cancelFrameSpy = vi.fn<(id: number) => void>();

    vi.stubGlobal('requestAnimationFrame', requestFrameSpy);
    vi.stubGlobal('cancelAnimationFrame', cancelFrameSpy);

    const renderFrameSpy = vi.fn();
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
      setPixel: () => undefined,
      getPixel: () => 0,
      setCLUTEntry: () => undefined,
      reset: () => undefined,
      renderFrame: renderFrameSpy,
    } satisfies CdgRenderContext;

    const afterRenderSpy = vi.fn();
    const player = new CDGPlayer({ context, afterRender: afterRenderSpy });

    const instruction = {
      execute: vi.fn(),
    };

    player.instructions = [instruction];
    player.pc = 0;
    player.sync({ ms: 500 });
    player.play();
    player.update(700);
    player.render();
    player.stop();

    expect(requestFrameSpy).toHaveBeenCalled();
    expect(instruction.execute).toHaveBeenCalled();
    expect(renderFrameSpy).toHaveBeenCalled();
    expect(afterRenderSpy).toHaveBeenCalled();
    expect(cancelFrameSpy).toHaveBeenCalled();
  });

  it('load parses sync packet data', () => {
    const bytes = new Uint8Array(PACKET_SIZE);
    bytes[0] = CDG_COMMAND;
    bytes[1] = CDG_NOOP;
    bytes[CDG_DATA] = 0x0f;

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
      setPixel: () => undefined,
      getPixel: () => 0,
      setCLUTEntry: () => undefined,
      reset: () => undefined,
      renderFrame: () => undefined,
    } satisfies CdgRenderContext;

    const player = new CDGPlayer({ context });
    player.load({ data: bytes });

    expect(player.instructions).toHaveLength(1);
    expect(player.pc).toBe(0);
  });
});
