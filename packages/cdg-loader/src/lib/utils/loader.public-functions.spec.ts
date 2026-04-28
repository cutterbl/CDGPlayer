import {
  baseNameFromPath,
  canBrowserPlayMedia,
  classifyMediaKind,
  extensionFromName,
  fileNameFromInput,
  inferMimeTypeFromExtension,
  isLikelySupportedMedia,
  metadataFromName,
  stemFromName,
} from './loader.public-functions.js';

describe('loader.public-functions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('parses file extensions, basenames, and stems', () => {
    expect(extensionFromName({ name: 'track.mp3' })).toBe('mp3');
    expect(extensionFromName({ name: 'track' })).toBeNull();
    expect(extensionFromName({ name: 'track.' })).toBeNull();

    expect(baseNameFromPath({ name: 'folder/sub/track.mp3' })).toBe(
      'track.mp3',
    );
    expect(baseNameFromPath({ name: 'folder\\sub\\track.mp3' })).toBe(
      'track.mp3',
    );

    expect(stemFromName({ name: 'folder/sub/track.mp3' })).toBe('track');
    expect(stemFromName({ name: 'no-extension' })).toBe('no-extension');
  });

  it('infers mime types from extension and media kind', () => {
    expect(inferMimeTypeFromExtension({ extension: 'mp4', kind: 'audio' })).toBe(
      'audio/mp4',
    );
    expect(inferMimeTypeFromExtension({ extension: 'mp4', kind: 'video' })).toBe(
      'video/mp4',
    );
    expect(
      inferMimeTypeFromExtension({ extension: 'webm', kind: 'video' }),
    ).toBe('video/webm');
    expect(inferMimeTypeFromExtension({ extension: 'mov', kind: 'video' })).toBe(
      'video/quicktime',
    );
    expect(inferMimeTypeFromExtension({ extension: 'mkv', kind: 'video' })).toBe(
      'video/x-matroska',
    );
    expect(inferMimeTypeFromExtension({ extension: 'avi', kind: 'video' })).toBe(
      'video/x-msvideo',
    );
    expect(inferMimeTypeFromExtension({ extension: 'unknown', kind: 'audio' })).toBe(
      'audio/mpeg',
    );
    expect(inferMimeTypeFromExtension({ extension: 'unknown', kind: 'video' })).toBe(
      'video/mp4',
    );
  });

  it('classifies media kinds using mime type before extension', () => {
    expect(
      classifyMediaKind({ mimeType: 'video/mp4', extension: 'mp3' }),
    ).toBe('video');
    expect(
      classifyMediaKind({ mimeType: 'audio/mpeg', extension: 'mp4' }),
    ).toBe('audio');
    expect(classifyMediaKind({ mimeType: undefined, extension: 'mp4' })).toBe(
      'video',
    );
    expect(classifyMediaKind({ mimeType: undefined, extension: 'flac' })).toBe(
      'audio',
    );
    expect(classifyMediaKind({ mimeType: undefined, extension: null })).toBeNull();
    expect(classifyMediaKind({ mimeType: undefined, extension: 'txt' })).toBeNull();
  });

  it('detects likely supported media from name and mime', () => {
    expect(isLikelySupportedMedia({ name: 'song.mp3' })).toBe(true);
    expect(isLikelySupportedMedia({ name: 'video.avi' })).toBe(true);
    expect(isLikelySupportedMedia({ name: 'blob.bin', mimeType: 'audio/ogg' })).toBe(
      true,
    );
    expect(isLikelySupportedMedia({ name: 'notes.txt' })).toBe(false);
  });

  it('checks browser playback support and treats missing document as compatible', () => {
    const canPlayType = vi.fn((mimeType: string) =>
      mimeType === 'video/mp4' ? 'probably' : '',
    );

    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        canPlayType,
      })),
    });

    expect(canBrowserPlayMedia({ mimeType: 'video/mp4', kind: 'video' })).toBe(
      true,
    );
    expect(canBrowserPlayMedia({ mimeType: 'video/x-msvideo', kind: 'video' })).toBe(
      false,
    );

    vi.stubGlobal('document', undefined);
    expect(canBrowserPlayMedia({ mimeType: 'video/mp4', kind: 'video' })).toBe(
      true,
    );
  });

  it('derives default names from loader input kinds', () => {
    const file = new File(['x'], 'track.zip', { type: 'application/zip' });

    expect(fileNameFromInput({ input: { kind: 'url', url: 'https://x/y/z.zip' } })).toBe(
      'z.zip',
    );
    expect(fileNameFromInput({ input: { kind: 'file', file } })).toBe('track.zip');
    expect(
      fileNameFromInput({
        input: {
          kind: 'blob',
          blob: new Blob(['x'], { type: 'audio/mpeg' }),
        },
      }),
    ).toBe('track-audio');
    expect(
      fileNameFromInput({
        input: {
          kind: 'blob',
          blob: new Blob(['x'], { type: 'application/octet-stream' }),
        },
      }),
    ).toBe('track-input');
    expect(
      fileNameFromInput({
        input: {
          kind: 'arrayBuffer',
          arrayBuffer: new ArrayBuffer(8),
        },
      }),
    ).toBe('track-input');
  });

  it('builds metadata from filename parts with sensible fallbacks', () => {
    expect(metadataFromName({ name: 'Album - Artist - Title.mp3' })).toEqual({
      album: 'Album',
      artist: 'Artist',
      title: 'Title',
    });

    expect(metadataFromName({ name: 'Artist - Title.mp3' })).toEqual({
      album: 'Artist',
      artist: 'Title',
      title: 'Title',
    });

    expect(metadataFromName({ name: 'OnlyTitle.mp3' })).toEqual({
      album: 'OnlyTitle',
      artist: 'OnlyTitle',
      title: 'OnlyTitle',
    });
  });
});
