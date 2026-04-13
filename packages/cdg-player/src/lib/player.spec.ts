import { createPlayer } from './player.js';
import * as loaderModule from '@cxing/cdg-loader';

describe('player', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => {
        const imageData = {
          data: new Uint8ClampedArray(300 * 216 * 4),
          width: 300,
          height: 216,
        } as unknown as ImageData;
        return {
          imageSmoothingEnabled: false,
          clearRect: () => {
            return;
          },
          drawImage: () => {
            return;
          },
          createImageData: () => imageData,
          putImageData: () => {
            return;
          },
        } as unknown as CanvasRenderingContext2D;
      },
    );

    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
      return;
    });

    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
      async () => {
        return;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a player with expected API', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    expect(player).toBeDefined();
    expect(player.getState().status).toBe('idle');

    player.dispose();
  });

  it('falls back safely when worklet mode is requested but unsupported', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('AudioWorkletNode', undefined);

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
        audioEngineMode: 'worklet',
      },
    });

    expect(player.getState().status).toBe('idle');

    player.setPitchSemitones({ value: -2.4 });

    expect(player.getState().pitchSemitones).toBe(-2);

    player.dispose();
  });

  it('initializes and tears down worker renderer when explicitly requested', () => {
    class MockWorker {
      static instances: MockWorker[] = [];

      postMessage = vi.fn();
      terminate = vi.fn();

      constructor(...args: unknown[]) {
        void args;
        MockWorker.instances.push(this);
      }
    }

    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    vi.stubGlobal(
      'OffscreenCanvas',
      class MockOffscreenCanvas {} as unknown as typeof OffscreenCanvas,
    );

    const canvas = document.createElement('canvas') as HTMLCanvasElement & {
      transferControlToOffscreen?: () => OffscreenCanvas;
    };
    const offscreenCanvas = {
      width: 300,
      height: 216,
      getContext: () => null,
    } as unknown as OffscreenCanvas;

    canvas.transferControlToOffscreen = () => offscreenCanvas;

    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
        renderMode: 'worker',
      },
    });

    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0]?.postMessage).toHaveBeenCalled();

    player.dispose();
    expect(MockWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('uses loader worker transport when explicitly requested', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return;
    });

    const loadInWorkerSpy = vi
      .spyOn(loaderModule, 'loadInWorker')
      .mockResolvedValue({
        trackId: 'track-id',
        sourceSummary: 'sample.zip',
        audioBuffer: new ArrayBuffer(8),
        cdgBytes: new Uint8Array(24),
        metadata: {
          title: 'Title',
          artist: 'Artist',
          album: 'Album',
        },
        warnings: [],
      });

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');
    vi.spyOn(audio, 'load').mockImplementation(() => {
      return;
    });

    const player = createPlayer({
      options: {
        canvas,
        audio,
        loadTransport: 'worker',
      },
    });

    await player.load({
      input: {
        kind: 'arrayBuffer',
        arrayBuffer: new ArrayBuffer(24),
      },
    });

    expect(loadInWorkerSpy).toHaveBeenCalledOnce();
    expect(player.getState().status).toBe('ready');

    player.dispose();
  });

  it('falls back to main-thread load when auto worker transport fails', async () => {
    vi.stubGlobal('Worker', class MockWorker {} as unknown as typeof Worker);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return;
    });

    const mockLoader = {
      load: vi.fn(async () => ({
        trackId: 'track-id',
        sourceSummary: 'sample.zip',
        audioBuffer: new ArrayBuffer(8),
        cdgBytes: new Uint8Array(24),
        metadata: {
          title: 'Title',
          artist: 'Artist',
          album: 'Album',
        },
        warnings: [],
      })),
      probe: vi.fn(),
      cancel: vi.fn(),
      dispose: vi.fn(),
    } as unknown as loaderModule.CdgLoader;

    vi.spyOn(loaderModule, 'createLoader').mockReturnValue(mockLoader);

    const loadInWorkerSpy = vi
      .spyOn(loaderModule, 'loadInWorker')
      .mockRejectedValue(
        new loaderModule.LoaderError({
          code: 'INTERNAL',
          message: 'Worker transport failed.',
          retriable: true,
        }),
      );

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');
    vi.spyOn(audio, 'load').mockImplementation(() => {
      return;
    });

    const player = createPlayer({
      options: {
        canvas,
        audio,
        loadTransport: 'auto',
      },
    });

    await player.load({
      input: {
        kind: 'arrayBuffer',
        arrayBuffer: new ArrayBuffer(24),
      },
    });

    expect(loadInWorkerSpy).toHaveBeenCalledOnce();
    expect(mockLoader.load).toHaveBeenCalledOnce();
    expect(player.getState().status).toBe('ready');

    player.dispose();
  });

  it('emits rendermetrics events while rendering', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return;
    });

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');
    vi.spyOn(audio, 'load').mockImplementation(() => {
      return;
    });

    const mockLoader = {
      load: vi.fn(async () => ({
        trackId: 'track-id',
        sourceSummary: 'sample.zip',
        audioBuffer: new ArrayBuffer(8),
        cdgBytes: new Uint8Array(24),
        metadata: {
          title: 'Title',
          artist: 'Artist',
          album: 'Album',
        },
        warnings: [],
      })),
      probe: vi.fn(),
      cancel: vi.fn(),
      dispose: vi.fn(),
    } as unknown as loaderModule.CdgLoader;

    const player = createPlayer({
      options: {
        canvas,
        audio,
        loader: mockLoader,
        loadTransport: 'main-thread',
        renderMode: 'main-thread',
      },
    });

    const metricsSpy = vi.fn();
    player.addEventListener('rendermetrics', metricsSpy);

    await player.load({
      input: {
        kind: 'arrayBuffer',
        arrayBuffer: new ArrayBuffer(24),
      },
    });

    expect(metricsSpy).toHaveBeenCalled();

    const metricsEvent = metricsSpy.mock.calls.at(-1)?.[0] as CustomEvent<{
      mode: 'main-thread' | 'worker';
      frameCpuMs: number;
      transferredBytes: number;
      atMs: number;
    }>;

    expect(metricsEvent.detail.mode).toBe('main-thread');
    expect(metricsEvent.detail.frameCpuMs).toBeGreaterThanOrEqual(0);
    expect(metricsEvent.detail.transferredBytes).toBe(0);
    expect(metricsEvent.detail.atMs).toBeGreaterThan(0);

    player.dispose();
  });

  it('tracks key changes in semitone steps', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    player.setPitchSemitones({ value: 3.6 });

    expect(player.getState().pitchSemitones).toBe(4);

    player.dispose();
  });

  it('tracks tempo using playback-rate state', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    player.setTempo({ value: 1.15 });

    expect(player.getState().playbackRate).toBe(1.15);

    player.dispose();
  });
});
