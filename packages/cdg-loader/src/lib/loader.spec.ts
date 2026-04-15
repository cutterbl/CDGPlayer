import { createLoader, loadInWorker, probeInWorker } from './loader.js';
import { LoaderError } from './errors.js';
import * as loaderCoreModule from './loader-core.js';

describe('createLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a loader instance with expected API', () => {
    const value = createLoader();

    expect(typeof value.load).toBe('function');
    expect(typeof value.probe).toBe('function');
    expect(typeof value.cancel).toBe('function');
    expect(typeof value.dispose).toBe('function');
    expect(typeof loadInWorker).toBe('function');
    expect(typeof probeInWorker).toBe('function');
  });

  it('falls back to main-thread loader when workers are not supported', async () => {
    vi.stubGlobal('Worker', undefined);

    const load = vi.fn(async () => ({
      trackId: 'fallback',
      sourceSummary: 'sample.zip',
      audioBuffer: new ArrayBuffer(8),
      cdgBytes: new Uint8Array(24),
      metadata: {
        title: 'Title',
        artist: 'Artist',
        album: 'Album',
      },
      warnings: [],
    }));

    const probe = vi.fn(async () => ({
      karaokeLikely: true,
      discoveredEntries: ['song.mp3', 'song.cdg'],
      hasExtraEntries: false,
      extensionCaseIssues: false,
    }));

    vi.spyOn(loaderCoreModule, 'createLoader').mockReturnValue({
      load,
      probe,
      cancel: vi.fn(),
      dispose: vi.fn(),
    } as unknown as loaderCoreModule.CdgLoader);

    const input = {
      kind: 'arrayBuffer' as const,
      arrayBuffer: new ArrayBuffer(8),
    };

    const loaded = await loadInWorker({ input });
    const probed = await probeInWorker({ input });

    expect(loaded.trackId).toBe('fallback');
    expect(probed.karaokeLikely).toBe(true);
    expect(load).toHaveBeenCalledOnce();
    expect(probe).toHaveBeenCalledOnce();
  });

  it('throws ABORTED before worker dispatch when signal is already aborted', async () => {
    class MockWorker {
      postMessage = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      terminate = vi.fn();
    }

    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);

    const controller = new AbortController();
    controller.abort();

    await expect(
      loadInWorker({
        input: { kind: 'arrayBuffer', arrayBuffer: new ArrayBuffer(2) },
        options: { signal: controller.signal },
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' });

    await expect(
      probeInWorker({
        input: { kind: 'arrayBuffer', arrayBuffer: new ArrayBuffer(2) },
        options: { signal: controller.signal },
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('handles successful worker load/probe round-trips', async () => {
    type MessageListener = (event: MessageEvent<unknown>) => void;

    class MockWorker {
      static onPost:
        | ((
            worker: MockWorker,
            message: { type: string; requestId: string },
          ) => void)
        | null = null;

      private listeners: Record<string, MessageListener[]> = {
        message: [],
        error: [],
      };

      postMessage = vi.fn((message: { type: string; requestId: string }) => {
        MockWorker.onPost?.(this, message);
      });

      addEventListener(type: string, listener: EventListener): void {
        this.listeners[type] ??= [];
        this.listeners[type]?.push(listener as MessageListener);
      }

      removeEventListener(type: string, listener: EventListener): void {
        const next = this.listeners[type]?.filter((item) => item !== listener);
        this.listeners[type] = next ?? [];
      }

      terminate = vi.fn();

      emitMessage(data: unknown): void {
        for (const listener of this.listeners.message) {
          listener({ data } as MessageEvent<unknown>);
        }
      }
    }

    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);

    MockWorker.onPost = (worker, message) => {
      if (message.type === 'load') {
        worker.emitMessage({
          type: 'load-result',
          requestId: message.requestId,
          ok: true,
          result: {
            trackId: 'worker-track',
            sourceSummary: 'worker.zip',
            audioBuffer: new ArrayBuffer(4),
            cdgBytes: new Uint8Array(6),
            metadata: {
              title: 'Title',
              artist: 'Artist',
              album: 'Album',
            },
            warnings: [],
          },
        });
        return;
      }

      if (message.type === 'probe') {
        worker.emitMessage({
          type: 'probe-result',
          requestId: message.requestId,
          ok: true,
          result: {
            karaokeLikely: true,
            discoveredEntries: ['song.mp3', 'song.cdg'],
            hasExtraEntries: false,
            extensionCaseIssues: false,
          },
        });
      }
    };

    const input = {
      kind: 'arrayBuffer' as const,
      arrayBuffer: new ArrayBuffer(4),
    };

    const loaded = await loadInWorker({
      input,
      options: { requestId: 'req-load' },
    });
    const probed = await probeInWorker({
      input,
      options: { requestId: 'req-probe' },
    });

    expect(loaded.trackId).toBe('worker-track');
    expect(probed.discoveredEntries).toEqual(['song.mp3', 'song.cdg']);
  });

  it('maps worker transport failures into LoaderError', async () => {
    class MockWorker {
      private listeners: Record<
        string,
        Array<(event: MessageEvent<unknown>) => void>
      > = {
        message: [],
        error: [],
      };

      postMessage = vi.fn((message: { requestId: string; type: string }) => {
        if (message.type === 'load') {
          for (const listener of this.listeners.message) {
            listener({
              data: {
                type: 'load-result',
                requestId: message.requestId,
                ok: false,
                error: {
                  code: 'INTERNAL',
                  message: 'worker failed',
                  retriable: true,
                  context: { source: 'worker' },
                },
              },
            } as MessageEvent<unknown>);
          }
          return;
        }

        for (const listener of this.listeners.error) {
          listener({} as MessageEvent<unknown>);
        }
      });

      addEventListener(type: string, listener: EventListener): void {
        this.listeners[type] ??= [];
        this.listeners[type]?.push(
          listener as (event: MessageEvent<unknown>) => void,
        );
      }

      removeEventListener(type: string, listener: EventListener): void {
        this.listeners[type] = (this.listeners[type] ?? []).filter(
          (item) => item !== listener,
        );
      }

      terminate = vi.fn();
    }

    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);

    await expect(
      loadInWorker({
        input: { kind: 'arrayBuffer', arrayBuffer: new ArrayBuffer(2) },
      }),
    ).rejects.toBeInstanceOf(LoaderError);

    await expect(
      probeInWorker({
        input: { kind: 'arrayBuffer', arrayBuffer: new ArrayBuffer(2) },
      }),
    ).rejects.toBeInstanceOf(LoaderError);
  });

  it('posts cancel and rejects when signal aborts after worker dispatch', async () => {
    type MessageListener = (event: MessageEvent<unknown>) => void;

    class MockWorker {
      private listeners: Record<string, MessageListener[]> = {
        message: [],
        error: [],
      };

      postMessage = vi.fn((message: { type: string; requestId?: string }) => {
        if (message.type === 'load') {
          for (const listener of this.listeners.message) {
            listener({
              data: {
                type: 'load-result',
                requestId: 'different-request',
                ok: true,
                result: {
                  trackId: 'ignored',
                  sourceSummary: 'ignored.zip',
                  audioBuffer: new ArrayBuffer(1),
                  cdgBytes: new Uint8Array([1]),
                  metadata: {
                    title: 'Ignored',
                    artist: 'Ignored',
                    album: 'Ignored',
                  },
                  warnings: [],
                },
              },
            } as MessageEvent<unknown>);
          }
        }
      });

      addEventListener(type: string, listener: EventListener): void {
        this.listeners[type] ??= [];
        this.listeners[type]?.push(listener as MessageListener);
      }

      removeEventListener(type: string, listener: EventListener): void {
        this.listeners[type] = (this.listeners[type] ?? []).filter(
          (item) => item !== (listener as MessageListener),
        );
      }

      terminate = vi.fn();
    }

    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);

    const controller = new AbortController();
    const loadPromise = loadInWorker({
      input: { kind: 'arrayBuffer', arrayBuffer: new ArrayBuffer(8) },
      options: { signal: controller.signal, requestId: 'abort-me' },
    });

    controller.abort();

    await expect(loadPromise).rejects.toMatchObject({ code: 'ABORTED' });
  });
});
