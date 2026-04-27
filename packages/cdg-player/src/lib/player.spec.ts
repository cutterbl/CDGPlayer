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
        audioMimeType: 'audio/mpeg',
        hasGraphics: true,
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
        audioMimeType: 'audio/mpeg',
        hasGraphics: true,
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

  it('clamps volume and tempo ranges', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    player.setVolume({ value: -10 });
    expect(player.getState().volume).toBe(0);

    player.setVolume({ value: 10 });
    expect(player.getState().volume).toBe(1);

    player.setTempo({ value: 0.1 });
    expect(player.getState().playbackRate).toBe(0.5);

    player.setPlaybackRate({ value: 4 });
    expect(player.getState().playbackRate).toBe(2);

    player.dispose();
  });

  it('seeks using clamped percentages when duration is valid', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 120,
    });

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    player.seek({ percentage: 150 });

    expect(audio.currentTime).toBe(120);
    expect(player.getState().currentTimeMs).toBe(120_000);

    player.dispose();
  });

  it('ignores seek when duration is unavailable', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: Number.NaN,
    });
    audio.currentTime = 10;

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    player.seek({ percentage: 50 });

    expect(audio.currentTime).toBe(10);
    player.dispose();
  });

  it('transitions to paused when pause is called before load', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    player.pause();
    expect(player.getState().status).toBe('paused');

    player.dispose();
  });

  it('sets ready state with zero position when playback ends', async () => {
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
        audioMimeType: 'audio/mpeg',
        hasGraphics: true,
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
      },
    });

    await player.load({
      input: {
        kind: 'arrayBuffer',
        arrayBuffer: new ArrayBuffer(24),
      },
    });

    audio.dispatchEvent(new Event('ended'));

    expect(player.getState().status).toBe('ready');
    expect(player.getState().currentTimeMs).toBe(0);

    player.dispose();
  });

  it('throws when canvas 2d context cannot be created', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementationOnce(
      () => null,
    );

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    expect(() =>
      createPlayer({
        options: {
          canvas,
          audio,
        },
      }),
    ).toThrow('Unable to create 2D context for karaoke player canvas.');
  });

  it('loads in main-thread mode without invoking worker transport', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return;
    });

    const loadInWorkerSpy = vi.spyOn(loaderModule, 'loadInWorker');
    const mockLoader = {
      load: vi.fn(async () => ({
        trackId: 'main-thread-track',
        sourceSummary: 'sample.zip',
        audioBuffer: new ArrayBuffer(8),
        audioMimeType: 'audio/mpeg',
        hasGraphics: true,
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

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');
    vi.spyOn(audio, 'load').mockImplementation(() => {
      return;
    });

    const player = createPlayer({
      options: {
        canvas,
        audio,
        loader: mockLoader,
        loadTransport: 'main-thread',
      },
    });

    await player.load({
      input: {
        kind: 'arrayBuffer',
        arrayBuffer: new ArrayBuffer(24),
      },
    });

    expect(loadInWorkerSpy).not.toHaveBeenCalled();
    expect(mockLoader.load).toHaveBeenCalledOnce();

    player.dispose();
  });

  it('emits error state/event when worker load fails without fallback', async () => {
    vi.stubGlobal('Worker', class MockWorker {} as unknown as typeof Worker);

    const workerError = new loaderModule.LoaderError({
      code: 'FETCH_FAILED',
      message: 'fetch failed',
      retriable: false,
    });

    vi.spyOn(loaderModule, 'loadInWorker').mockRejectedValue(workerError);

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
        loadTransport: 'worker',
      },
    });

    const onError = vi.fn();
    player.addEventListener('error', onError);

    await expect(
      player.load({
        input: {
          kind: 'arrayBuffer',
          arrayBuffer: new ArrayBuffer(24),
        },
      }),
    ).rejects.toBe(workerError);

    expect(player.getState().status).toBe('error');
    expect(onError).toHaveBeenCalledOnce();

    player.dispose();
  });

  it('falls back in auto mode when worker load throws non-loader error', async () => {
    vi.stubGlobal('Worker', class MockWorker {} as unknown as typeof Worker);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return;
    });

    const loadInWorkerSpy = vi
      .spyOn(loaderModule, 'loadInWorker')
      .mockRejectedValue(new Error('unexpected worker failure'));

    const mockLoader = {
      load: vi.fn(async () => ({
        trackId: 'fallback-track',
        sourceSummary: 'sample.zip',
        audioBuffer: new ArrayBuffer(8),
        audioMimeType: 'audio/mpeg',
        hasGraphics: true,
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

    player.dispose();
  });

  it('autoplay transitions to playing state after load', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return;
    });

    const mockLoader = {
      load: vi.fn(async () => ({
        trackId: 'track-id',
        sourceSummary: 'sample.zip',
        audioBuffer: new ArrayBuffer(8),
        audioMimeType: 'audio/mpeg',
        hasGraphics: true,
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

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');
    vi.spyOn(audio, 'load').mockImplementation(() => {
      return;
    });

    const player = createPlayer({
      options: {
        canvas,
        audio,
        loader: mockLoader,
      },
    });

    await player.load({
      input: {
        kind: 'arrayBuffer',
        arrayBuffer: new ArrayBuffer(24),
      },
      autoplay: true,
    });

    expect(player.getState().status).toBe('playing');

    player.dispose();
  });

  it('does not transition to paused for idle status pause event', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    audio.dispatchEvent(new Event('pause'));

    expect(player.getState().status).toBe('idle');

    player.dispose();
  });

  it('updates state to playing for play event', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    audio.dispatchEvent(new Event('play'));

    expect(player.getState().status).toBe('playing');

    player.dispose();
  });

  it('updates playback time state for timeupdate events', () => {
    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 123.456,
    });
    audio.currentTime = 12.345;

    const player = createPlayer({
      options: {
        canvas,
        audio,
      },
    });

    audio.dispatchEvent(new Event('timeupdate'));

    expect(player.getState().currentTimeMs).toBe(12_345);
    expect(player.getState().durationMs).toBe(123_456);

    player.dispose();
  });

  it('uses synchronous core load path when loadAsync is unavailable', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return;
    });

    const mockLoader = {
      load: vi.fn(async () => ({
        trackId: 'sync-track',
        sourceSummary: 'sample.zip',
        audioBuffer: new ArrayBuffer(8),
        audioMimeType: 'audio/mpeg',
        hasGraphics: true,
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

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');
    vi.spyOn(audio, 'load').mockImplementation(() => {
      return;
    });

    const player = createPlayer({
      options: {
        canvas,
        audio,
        loader: mockLoader,
      },
    }) as unknown as {
      load: (args: {
        input: { kind: 'arrayBuffer'; arrayBuffer: ArrayBuffer };
      }) => Promise<unknown>;
      cdgPlayer: {
        loadAsync?: unknown;
        load: ReturnType<typeof vi.fn>;
      };
      dispose: () => void;
    };

    const loadSpy = vi.fn();
    player.cdgPlayer.loadAsync = undefined;
    player.cdgPlayer.load = loadSpy;

    await player.load({
      input: {
        kind: 'arrayBuffer',
        arrayBuffer: new ArrayBuffer(24),
      },
    });

    expect(loadSpy).toHaveBeenCalledOnce();

    player.dispose();
  });

  it('loads and plays audio-only tracks without graphics bytes', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return;
    });

    const mockLoader = {
      load: vi.fn(async () => ({
        trackId: 'audio-only-track',
        sourceSummary: 'song.ogg',
        audioBuffer: new ArrayBuffer(8),
        audioMimeType: 'audio/ogg',
        hasGraphics: false,
        cdgBytes: null,
        metadata: {
          title: 'Song',
          artist: 'Artist',
          album: 'Album',
        },
        warnings: [],
      })),
      probe: vi.fn(),
      cancel: vi.fn(),
      dispose: vi.fn(),
    } as unknown as loaderModule.CdgLoader;

    const canvas = document.createElement('canvas');
    const audio = document.createElement('audio');
    vi.spyOn(audio, 'load').mockImplementation(() => {
      return;
    });

    const player = createPlayer({
      options: {
        canvas,
        audio,
        loader: mockLoader,
      },
    });

    await player.load({
      input: {
        kind: 'arrayBuffer',
        arrayBuffer: new ArrayBuffer(16),
      },
    });

    expect(player.getState().status).toBe('ready');

    await player.play();
    expect(player.getState().status).toBe('playing');

    player.pause();
    expect(player.getState().status).toBe('paused');

    player.dispose();
  });
});
