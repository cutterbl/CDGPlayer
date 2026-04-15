import JSZip from 'jszip';
import { read as readMediaTags } from 'jsmediatags';
import { createScopedLogger } from '@cxing/logger';
import { LoaderError } from './errors.js';
import type {
  LoadedTrack,
  LoaderInput,
  LoaderMetadata,
  LoaderOptions,
  LoaderProbeResult,
} from './types.js';

const fileNameFromInput = ({ input }: { input: LoaderInput }): string => {
  switch (input.kind) {
    case 'url': {
      const parts = input.url.split('/');
      return parts[parts.length - 1] ?? 'track.zip';
    }
    case 'file':
      return input.file.name;
    case 'blob':
      return 'track.zip';
    case 'arrayBuffer':
      return 'track.zip';
    default:
      return 'track.zip';
  }
};

const metadataFromName = ({ name }: { name: string }): LoaderMetadata => {
  const baseName = name.replace(/\.[^.]+$/u, '');
  const parts = baseName
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    album: parts[0] ?? 'Unknown Album',
    artist: parts[1] ?? parts[0] ?? 'Unknown Artist',
    title: parts[2] ?? parts[1] ?? parts[0] ?? 'Unknown Title',
  };
};

const asTagValue = ({ value }: { value: unknown }): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const readMetadataFromAudio = async ({
  audioBuffer,
}: {
  audioBuffer: ArrayBuffer;
}): Promise<Partial<LoaderMetadata>> => {
  return new Promise((resolve) => {
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    readMediaTags(audioBlob, {
      onSuccess: (tagResult) => {
        const tags = tagResult.tags ?? {};
        const nextMetadata: Partial<LoaderMetadata> = {};

        const title = asTagValue({ value: tags['title'] });
        if (title) {
          nextMetadata.title = title;
        }

        const artist = asTagValue({ value: tags['artist'] });
        if (artist) {
          nextMetadata.artist = artist;
        }

        const album = asTagValue({ value: tags['album'] });
        if (album) {
          nextMetadata.album = album;
        }

        resolve(nextMetadata);
      },
      onError: () => {
        resolve({});
      },
    });
  });
};

const hasAnyEmbeddedMetadata = ({
  metadata,
}: {
  metadata: Partial<LoaderMetadata>;
}): boolean => {
  return Boolean(metadata.title || metadata.artist || metadata.album);
};

const mergeMetadata = ({
  preferred,
  fallback,
}: {
  preferred: Partial<LoaderMetadata>;
  fallback: LoaderMetadata;
}): LoaderMetadata => {
  return {
    title: preferred.title ?? fallback.title,
    artist: preferred.artist ?? fallback.artist,
    album: preferred.album ?? fallback.album,
  };
};

const asArrayBuffer = async ({
  input,
  signal,
}: {
  input: LoaderInput;
  signal?: AbortSignal;
}): Promise<ArrayBuffer> => {
  switch (input.kind) {
    case 'url': {
      const requestInit: RequestInit = signal ? { signal } : {};
      const response = await fetch(input.url, requestInit);
      if (!response.ok) {
        throw new LoaderError({
          code: 'FETCH_FAILED',
          message: `Unable to fetch ${input.url} (${response.status})`,
          retriable: true,
          context: { source: input.url, details: String(response.status) },
        });
      }
      return response.arrayBuffer();
    }
    case 'file':
      return input.file.arrayBuffer();
    case 'blob':
      return input.blob.arrayBuffer();
    case 'arrayBuffer':
      return input.arrayBuffer;
    default:
      throw new LoaderError({
        code: 'INPUT_UNSUPPORTED',
        message: 'Unsupported loader input type.',
        retriable: false,
      });
  }
};

const getKaraokeEntries = ({
  zip,
  strictValidation,
}: {
  zip: JSZip;
  strictValidation: boolean;
}): {
  audio: JSZip.JSZipObject;
  graphics: JSZip.JSZipObject;
  warnings: string[];
} => {
  const allEntries = Object.values(zip.files).filter((entry) => !entry.dir);
  const audioEntries = allEntries.filter((entry) =>
    /\.mp3$/iu.test(entry.name),
  );
  const graphicsEntries = allEntries.filter((entry) =>
    /\.cdg$/iu.test(entry.name),
  );
  const warnings: string[] = [];

  if (!audioEntries.length || !graphicsEntries.length) {
    throw new LoaderError({
      code: 'KARAOKE_FILES_MISSING',
      message: 'Expected both mp3 and cdg files in archive.',
      retriable: false,
    });
  }

  if (audioEntries.length > 1) {
    if (strictValidation) {
      throw new LoaderError({
        code: 'MULTIPLE_AUDIO_TRACKS',
        message: 'Multiple mp3 files found and strict validation is enabled.',
        retriable: false,
      });
    }
    warnings.push('Multiple mp3 files found; selected first match.');
  }

  if (graphicsEntries.length > 1) {
    if (strictValidation) {
      throw new LoaderError({
        code: 'MULTIPLE_GRAPHICS_TRACKS',
        message: 'Multiple cdg files found and strict validation is enabled.',
        retriable: false,
      });
    }
    warnings.push('Multiple cdg files found; selected first match.');
  }

  const audio = audioEntries.at(0);
  const graphics = graphicsEntries.at(0);

  if (!audio || !graphics) {
    throw new LoaderError({
      code: 'KARAOKE_FILES_MISSING',
      message: 'Expected both mp3 and cdg files in archive.',
      retriable: false,
    });
  }

  return {
    audio,
    graphics,
    warnings,
  };
};

/**
 * Zip-based karaoke loader used by main-thread and worker transports.
 */
export class CdgLoader {
  private readonly controllers = new Map<string, AbortController>();
  private readonly debug: boolean;

  constructor({ debug = false }: { debug?: boolean } = {}) {
    this.debug = debug;
  }

  /**
   * Loads and validates karaoke assets from supported input types.
   */
  async load({
    input,
    options = {},
  }: {
    input: LoaderInput;
    options?: LoaderOptions;
  }): Promise<LoadedTrack> {
    const logger = createScopedLogger({
      scope: 'cdg-loader-core',
      debug: options.debug ?? this.debug,
    });

    logger.debug({
      message: 'load:start',
      inputKind: input.kind,
      requestId: options.requestId ?? null,
      strictValidation: options.strictValidation ?? false,
    });

    const controller = new AbortController();
    if (options.requestId) {
      this.controllers.set(options.requestId, controller);
    }

    if (options.signal) {
      options.signal.addEventListener(
        'abort',
        () => controller.abort(options.signal?.reason),
        {
          once: true,
        },
      );
    }

    try {
      const archiveBuffer = await asArrayBuffer({
        input,
        signal: controller.signal,
      });
      logger.debug({
        message: 'load:archive-read',
        bytes: archiveBuffer.byteLength,
      });
      const zip = await JSZip.loadAsync(archiveBuffer).catch(
        (causeValue: unknown) => {
          throw new LoaderError({
            code: 'ARCHIVE_INVALID',
            message: 'Unable to parse archive as zip data.',
            retriable: false,
            causeValue,
          });
        },
      );

      const selection = getKaraokeEntries({
        zip,
        strictValidation: options.strictValidation ?? false,
      });
      logger.debug({
        message: 'load:entries-selected',
        audio: selection.audio.name,
        graphics: selection.graphics.name,
        warnings: selection.warnings,
      });

      const [audioBuffer, cdgBytes] = await Promise.all([
        selection.audio.async('arraybuffer').catch((causeValue: unknown) => {
          throw new LoaderError({
            code: 'AUDIO_UNREADABLE',
            message: 'Unable to read mp3 payload from archive.',
            retriable: false,
            causeValue,
          });
        }),
        selection.graphics.async('uint8array').catch((causeValue: unknown) => {
          throw new LoaderError({
            code: 'GRAPHICS_UNREADABLE',
            message: 'Unable to read cdg payload from archive.',
            retriable: false,
            causeValue,
          });
        }),
      ]);

      const sourceSummary = fileNameFromInput({ input });
      const fallbackMetadata = metadataFromName({ name: selection.audio.name });
      const embeddedMetadata = await readMetadataFromAudio({ audioBuffer });
      if (!hasAnyEmbeddedMetadata({ metadata: embeddedMetadata })) {
        logger.info({
          message: 'metadata:fallback-filename',
          sourceSummary,
          audioEntry: selection.audio.name,
        });
      }

      const metadata = mergeMetadata({
        preferred: embeddedMetadata,
        fallback: fallbackMetadata,
      });
      logger.debug({
        message: 'load:success',
        sourceSummary,
        audioBytes: audioBuffer.byteLength,
        cdgBytes: cdgBytes.byteLength,
        metadata,
      });
      return {
        trackId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        sourceSummary,
        audioBuffer,
        cdgBytes,
        metadata,
        warnings: selection.warnings,
      };
    } catch (errorValue: unknown) {
      logger.debug({ message: 'load:error', errorValue });

      if (errorValue instanceof LoaderError) {
        logger.error({
          message: 'load:loader-error',
          code: errorValue.code,
          loaderMessage: errorValue.message,
          retriable: errorValue.retriable,
          context: errorValue.context,
        });
        throw errorValue;
      }

      logger.error({ message: 'load:unexpected-error', errorValue });

      if (controller.signal.aborted) {
        const abortedError = new LoaderError({
          code: 'ABORTED',
          message: 'Load was aborted.',
          retriable: true,
          causeValue: errorValue,
        });
        logger.error({
          message: 'load:aborted',
          code: abortedError.code,
          loaderMessage: abortedError.message,
        });
        throw abortedError;
      }

      const internalError = new LoaderError({
        code: 'INTERNAL',
        message: 'Unexpected loader failure.',
        retriable: false,
        causeValue: errorValue,
      });
      logger.error({
        message: 'load:internal',
        code: internalError.code,
        loaderMessage: internalError.message,
      });
      throw internalError;
    } finally {
      if (options.requestId) {
        this.controllers.delete(options.requestId);
      }
    }
  }

  /**
   * Probes an archive for likely karaoke content without fully loading track data.
   */
  async probe({
    input,
    options = {},
  }: {
    input: LoaderInput;
    options?: LoaderOptions;
  }): Promise<LoaderProbeResult> {
    const logger = createScopedLogger({
      scope: 'cdg-loader-core',
      debug: options.debug ?? this.debug,
    });

    logger.debug({
      message: 'probe:start',
      inputKind: input.kind,
      requestId: options.requestId ?? null,
    });
    const archiveBuffer = await asArrayBuffer({
      input,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const zip = await JSZip.loadAsync(archiveBuffer).catch(() => null);

    if (!zip) {
      return {
        karaokeLikely: false,
        discoveredEntries: [],
        hasExtraEntries: false,
        extensionCaseIssues: false,
      };
    }

    const names = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name);

    const karaokeEntries = names.filter((name) => /\.(mp3|cdg)$/iu.test(name));
    const lowerCasedMismatches = names.some(
      (name) => /\.(MP3|CDG)$/u.test(name) && !/\.(mp3|cdg)$/u.test(name),
    );

    logger.debug({
      message: 'probe:result',
      entryCount: names.length,
      karaokeEntries: karaokeEntries.length,
      extensionCaseIssues: lowerCasedMismatches,
    });

    return {
      karaokeLikely: karaokeEntries.length >= 2,
      discoveredEntries: names,
      hasExtraEntries: names.length > karaokeEntries.length,
      extensionCaseIssues: lowerCasedMismatches,
    };
  }

  /**
   * Cancels an in-flight request by request id.
   */
  cancel({ requestId }: { requestId: string }): void {
    const controller = this.controllers.get(requestId);
    controller?.abort();
    this.controllers.delete(requestId);
  }

  /**
   * Aborts all active requests and clears internal state.
   */
  dispose(): void {
    for (const controller of this.controllers.values()) {
      controller.abort();
    }
    this.controllers.clear();
  }
}

/**
 * Factory helper for creating a CdgLoader instance.
 */
export const createLoader = ({
  debug = false,
}: {
  debug?: boolean;
} = {}): CdgLoader => new CdgLoader({ debug });
