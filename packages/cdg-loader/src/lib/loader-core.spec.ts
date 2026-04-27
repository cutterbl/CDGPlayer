import JSZip from 'jszip';
const readMediaTagsMock = vi.hoisted(() => vi.fn());

vi.mock('jsmediatags', () => ({
  read: readMediaTagsMock,
}));

import { CdgLoader } from './loader-core.js';

describe('CdgLoader core behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const createZipArrayBuffer = async ({
    entries,
  }: {
    entries: Array<{ name: string; content: Uint8Array }>;
  }): Promise<ArrayBuffer> => {
    const zip = new JSZip();
    for (const entry of entries) {
      zip.file(entry.name, entry.content);
    }

    return zip.generateAsync({ type: 'arraybuffer' });
  };

  it('loads from arrayBuffer and falls back metadata to filename when tags fail', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        {
          name: 'Album - Artist - Title.mp3',
          content: new Uint8Array([1, 2, 3]),
        },
        {
          name: 'graphics.cdg',
          content: new Uint8Array([4, 5, 6, 7]),
        },
      ],
    });

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
      options: { requestId: 'req-1' },
    });

    expect(loaded.sourceSummary).toBe('track-input');
    expect(loaded.metadata).toEqual({
      album: 'Album',
      artist: 'Artist',
      title: 'Title',
    });
    expect(loaded.warnings).toEqual([]);
    expect(loaded.audioBuffer.byteLength).toBeGreaterThan(0);
    expect(loaded.hasGraphics).toBe(true);
    expect(loaded.cdgBytes).not.toBeNull();
    expect(loaded.cdgBytes?.byteLength ?? 0).toBeGreaterThan(0);
  });

  it('prefers embedded metadata when tag parser succeeds', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: { tags: Record<string, unknown> }) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onSuccess?.({
          tags: {
            title: 'Embedded Title',
            artist: 'Embedded Artist',
            album: 'Embedded Album',
          },
        });
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        {
          name: 'Fallback Album - Fallback Artist - Fallback Title.mp3',
          content: new Uint8Array([1, 2, 3]),
        },
        {
          name: 'graphics.cdg',
          content: new Uint8Array([4, 5, 6, 7]),
        },
      ],
    });

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
    });

    expect(loaded.metadata).toEqual({
      album: 'Embedded Album',
      artist: 'Embedded Artist',
      title: 'Embedded Title',
    });
  });

  it('throws when strict validation sees multiple mp3 files', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        {
          name: 'first.mp3',
          content: new Uint8Array([1]),
        },
        {
          name: 'second.mp3',
          content: new Uint8Array([2]),
        },
        {
          name: 'graphics.cdg',
          content: new Uint8Array([3]),
        },
      ],
    });

    const loader = new CdgLoader();

    await expect(
      loader.load({
        input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
        options: { strictValidation: true },
      }),
    ).rejects.toMatchObject({ code: 'MULTIPLE_AUDIO_TRACKS' });
  });

  it('probe flags karaoke likelihood, extras, and extension case issues', async () => {
    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        {
          name: 'Song.MP3',
          content: new Uint8Array([1]),
        },
        {
          name: 'Song.CDG',
          content: new Uint8Array([2]),
        },
        {
          name: 'notes.txt',
          content: new Uint8Array([3]),
        },
      ],
    });

    const loader = new CdgLoader();
    const result = await loader.probe({
      input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
    });

    expect(result.karaokeLikely).toBe(true);
    expect(result.audioLikely).toBe(true);
    expect(result.hasExtraEntries).toBe(true);
    expect(result.extensionCaseIssues).toBe(true);
    expect(result.discoveredEntries).toEqual(
      expect.arrayContaining(['Song.MP3', 'Song.CDG', 'notes.txt']),
    );
  });

  it('supports canceling a request by id', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const fetchSpy = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener(
            'abort',
            () => {
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        }),
    );

    vi.stubGlobal('fetch', fetchSpy);

    const loader = new CdgLoader();

    const loadPromise = loader.load({
      input: { kind: 'url', url: 'https://example.test/song.zip' },
      options: { requestId: 'cancel-me' },
    });

    loader.cancel({ requestId: 'cancel-me' });

    await expect(loadPromise).rejects.toMatchObject({ code: 'ABORTED' });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('loads from file input and keeps file name as sourceSummary', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: { tags: Record<string, unknown> }) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onSuccess?.({
          tags: {
            title: '  ',
            artist: 123,
            album: 'Embedded Album',
          },
        });
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        {
          name: 'Fallback Album - Fallback Artist - Fallback Title.mp3',
          content: new Uint8Array([1, 2, 3]),
        },
        {
          name: 'graphics.cdg',
          content: new Uint8Array([4, 5, 6, 7]),
        },
      ],
    });

    const file = new File([archiveBuffer], 'karaoke-track.zip', {
      type: 'application/zip',
    });

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: { kind: 'file', file },
    });

    expect(loaded.sourceSummary).toBe('karaoke-track.zip');
    expect(loaded.metadata).toEqual({
      album: 'Embedded Album',
      artist: 'Fallback Artist',
      title: 'Fallback Title',
    });
  });

  it('loads from blob input and uses non-strict warning paths', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        { name: 'song-a.mp3', content: new Uint8Array([1]) },
        { name: 'song-b.mp3', content: new Uint8Array([2]) },
        { name: 'song-a.cdg', content: new Uint8Array([3]) },
      ],
    });

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: {
        kind: 'blob',
        blob: new Blob([archiveBuffer], { type: 'application/zip' }),
      },
    });

    expect(loaded.sourceSummary).toBe('track-input');
    expect(loaded.warnings).toEqual([
      'Multiple supported audio files found; selected best match.',
    ]);
  });

  it('throws strict graphics validation when multiple cdg entries exist', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        { name: 'song.mp3', content: new Uint8Array([1]) },
        { name: 'song-a.cdg', content: new Uint8Array([2]) },
        { name: 'song-b.cdg', content: new Uint8Array([3]) },
      ],
    });

    const loader = new CdgLoader();

    await expect(
      loader.load({
        input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
        options: { strictValidation: true },
      }),
    ).rejects.toMatchObject({ code: 'MULTIPLE_GRAPHICS_TRACKS' });
  });

  it('throws when karaoke files are missing', async () => {
    const archiveBuffer = await createZipArrayBuffer({
      entries: [{ name: 'notes.txt', content: new Uint8Array([1, 2, 3]) }],
    });

    const loader = new CdgLoader();

    await expect(
      loader.load({
        input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
      }),
    ).rejects.toMatchObject({ code: 'KARAOKE_FILES_MISSING' });
  });

  it('loads an audio-only zip without graphics payload', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        {
          name: 'Artist - Song.mp3',
          content: new Uint8Array([1, 2, 3]),
        },
      ],
    });

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
    });

    expect(loaded.hasGraphics).toBe(false);
    expect(loaded.cdgBytes).toBeNull();
    expect(loaded.audioMimeType).toBe('audio/mpeg');
    expect(loaded.metadata.title).toBe('Song');
  });

  it('selects the audio entry whose stem matches the discovered graphics track', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        { name: 'aaa-intro.mp3', content: new Uint8Array([1]) },
        { name: 'bbb-main.mp3', content: new Uint8Array([2]) },
        { name: 'bbb-main.cdg', content: new Uint8Array([3]) },
      ],
    });

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
    });

    expect(loaded.metadata.title).toBe('bbb-main');
    expect(loaded.hasGraphics).toBe(true);
  });

  it('keeps loading when multiple graphics tracks exist in non-strict mode', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        { name: 'song.mp3', content: new Uint8Array([1]) },
        { name: 'song-a.cdg', content: new Uint8Array([2]) },
        { name: 'song-b.cdg', content: new Uint8Array([3]) },
      ],
    });

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
    });

    expect(loaded.warnings).toEqual([
      'Multiple cdg files found; selected first match.',
    ]);
    expect(loaded.hasGraphics).toBe(true);
  });

  it('loads raw audio file input when zip parsing fails', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const file = new File(
      [new Uint8Array([8, 7, 6])],
      'Demo - Artist - Song.mp3',
      {
        type: 'audio/mpeg',
      },
    );

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: { kind: 'file', file },
    });

    expect(loaded.hasGraphics).toBe(false);
    expect(loaded.cdgBytes).toBeNull();
    expect(loaded.audioMimeType).toBe('audio/mpeg');
    expect(loaded.sourceSummary).toBe('Demo - Artist - Song.mp3');
  });

  it('loads raw audio when support is inferred from file extension alone', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const file = new File([new Uint8Array([8, 7, 6])], 'Demo Track.wav', {
      type: '',
    });

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: { kind: 'file', file },
    });

    expect(loaded.audioMimeType).toBe('audio/wav');
    expect(loaded.hasGraphics).toBe(false);
  });

  it('probes raw audio blob inputs by mime type when zip parsing fails', async () => {
    const loader = new CdgLoader();

    await expect(
      loader.probe({
        input: {
          kind: 'blob',
          blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/ogg' }),
        },
      }),
    ).resolves.toEqual({
      karaokeLikely: false,
      audioLikely: true,
      discoveredEntries: [],
      hasExtraEntries: false,
      extensionCaseIssues: false,
    });
  });

  it('throws FETCH_FAILED when url input returns non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 503,
            statusText: 'Service Unavailable',
          }),
      ),
    );

    const loader = new CdgLoader();

    await expect(
      loader.load({
        input: { kind: 'url', url: 'https://example.test/unavailable.zip' },
      }),
    ).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  });

  it('loads from url input and keeps trailing file segment in sourceSummary', async () => {
    readMediaTagsMock.mockImplementation(
      (
        _blob: unknown,
        callbacks: {
          onSuccess?: (value: unknown) => void;
          onError?: (value: unknown) => void;
        },
      ) => {
        callbacks.onError?.(new Error('no tags'));
      },
    );

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        { name: 'Album - Artist - Title.mp3', content: new Uint8Array([1]) },
        { name: 'song.cdg', content: new Uint8Array([2]) },
      ],
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(archiveBuffer, {
            status: 200,
          }),
      ),
    );

    const loader = new CdgLoader();
    const loaded = await loader.load({
      input: {
        kind: 'url',
        url: 'https://example.test/media/song-bundle.zip',
      },
    });

    expect(loaded.sourceSummary).toBe('song-bundle.zip');
  });

  it('maps invalid raw payloads to AUDIO_FORMAT_UNSUPPORTED and probe fallback shape', async () => {
    const loader = new CdgLoader();

    await expect(
      loader.load({
        input: { kind: 'arrayBuffer', arrayBuffer: new Uint8Array([1]).buffer },
      }),
    ).rejects.toMatchObject({ code: 'AUDIO_FORMAT_UNSUPPORTED' });

    await expect(
      loader.probe({
        input: { kind: 'arrayBuffer', arrayBuffer: new Uint8Array([1]).buffer },
      }),
    ).resolves.toEqual({
      karaokeLikely: false,
      audioLikely: false,
      discoveredEntries: [],
      hasExtraEntries: false,
      extensionCaseIssues: false,
    });
  });

  it('maps thrown metadata parser errors to INTERNAL', async () => {
    readMediaTagsMock.mockImplementation(() => {
      throw new Error('reader crashed');
    });

    const archiveBuffer = await createZipArrayBuffer({
      entries: [
        { name: 'Album - Artist - Title.mp3', content: new Uint8Array([1]) },
        { name: 'song.cdg', content: new Uint8Array([2]) },
      ],
    });

    const loader = new CdgLoader();

    await expect(
      loader.load({
        input: { kind: 'arrayBuffer', arrayBuffer: archiveBuffer },
      }),
    ).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('maps unreadable audio payloads to AUDIO_UNREADABLE', async () => {
    vi.spyOn(JSZip, 'loadAsync').mockResolvedValue({
      files: {
        'song.mp3': {
          dir: false,
          name: 'song.mp3',
          async: vi.fn(async () => {
            throw new Error('broken audio entry');
          }),
        },
        'song.cdg': {
          dir: false,
          name: 'song.cdg',
          async: vi.fn(async () => new Uint8Array([1, 2, 3])),
        },
      },
    } as unknown as JSZip);

    const loader = new CdgLoader();

    await expect(
      loader.load({
        input: { kind: 'arrayBuffer', arrayBuffer: new ArrayBuffer(8) },
      }),
    ).rejects.toMatchObject({ code: 'AUDIO_UNREADABLE' });
  });

  it('maps unreadable graphics payloads to GRAPHICS_UNREADABLE', async () => {
    vi.spyOn(JSZip, 'loadAsync').mockResolvedValue({
      files: {
        'song.mp3': {
          dir: false,
          name: 'song.mp3',
          async: vi.fn(async () => new ArrayBuffer(3)),
        },
        'song.cdg': {
          dir: false,
          name: 'song.cdg',
          async: vi.fn(async () => {
            throw new Error('broken graphics entry');
          }),
        },
      },
    } as unknown as JSZip);

    const loader = new CdgLoader();

    await expect(
      loader.load({
        input: { kind: 'arrayBuffer', arrayBuffer: new ArrayBuffer(8) },
      }),
    ).rejects.toMatchObject({ code: 'GRAPHICS_UNREADABLE' });
  });

  it('propagates external abort signals into the active load controller', async () => {
    const fetchSpy = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );

    vi.stubGlobal('fetch', fetchSpy);

    const loader = new CdgLoader();
    const controller = new AbortController();
    const loadPromise = loader.load({
      input: { kind: 'url', url: 'https://example.test/abort-via-signal.zip' },
      options: { signal: controller.signal },
    });

    controller.abort();

    await expect(loadPromise).rejects.toMatchObject({ code: 'ABORTED' });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('aborts all tracked requests when disposed', async () => {
    const fetchSpy = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );

    vi.stubGlobal('fetch', fetchSpy);
    const loader = new CdgLoader();

    const loadPromise = loader.load({
      input: { kind: 'url', url: 'https://example.test/dispose.zip' },
      options: { requestId: 'dispose-me' },
    });

    loader.dispose();

    await expect(loadPromise).rejects.toMatchObject({ code: 'ABORTED' });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
