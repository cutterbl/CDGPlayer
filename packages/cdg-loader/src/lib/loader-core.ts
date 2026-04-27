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

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'aac',
  'm4a',
  'mp4',
  'ogg',
  'opus',
  'wav',
  'webm',
  'flac',
]);

const extensionFromName = ({ name }: { name: string }): string | null => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === name.length - 1) {
    return null;
  }

  return name.slice(dotIndex + 1).toLowerCase();
};

const baseNameFromPath = ({ name }: { name: string }): string => {
  const slashIndex = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  return slashIndex >= 0 ? name.slice(slashIndex + 1) : name;
};

const stemFromName = ({ name }: { name: string }): string => {
  const baseName = baseNameFromPath({ name });
  const dotIndex = baseName.lastIndexOf('.');
  return dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
};

const inferMimeTypeFromExtension = ({
  extension,
}: {
  extension: string | null;
}): string => {
  switch (extension) {
    case 'mp3':
      return 'audio/mpeg';
    case 'aac':
      return 'audio/aac';
    case 'm4a':
      return 'audio/mp4';
    case 'mp4':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'opus':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case 'flac':
      return 'audio/flac';
    default:
      return 'audio/mpeg';
  }
};

const isLikelySupportedAudio = ({
  name,
  mimeType,
}: {
  name: string;
  mimeType?: string;
}): boolean => {
  const normalizedMime = (mimeType ?? '').trim().toLowerCase();
  if (normalizedMime.startsWith('audio/')) {
    return true;
  }

  const extension = extensionFromName({ name });
  if (!extension) {
    return false;
  }

  return SUPPORTED_AUDIO_EXTENSIONS.has(extension);
};

const fileNameFromInput = ({ input }: { input: LoaderInput }): string => {
  switch (input.kind) {
    case 'url': {
      const parts = input.url.split('/');
      return parts[parts.length - 1] ?? 'track.zip';
    }
    case 'file':
      return input.file.name;
    case 'blob':
      return input.blob.type.startsWith('audio/')
        ? 'track-audio'
        : 'track-input';
    case 'arrayBuffer':
      return 'track-input';
    default:
      return 'track.zip';
  }
};

const metadataFromName = ({ name }: { name: string }): LoaderMetadata => {
  const baseName = stemFromName({ name });
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
  audioMimeType,
}: {
  audioBuffer: ArrayBuffer;
  audioMimeType: string;
}): Promise<Partial<LoaderMetadata>> => {
  return new Promise((resolve) => {
    const audioBlob = new Blob([audioBuffer], { type: audioMimeType });

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

const getTrackEntries = ({
  zip,
  strictValidation,
}: {
  zip: JSZip;
  strictValidation: boolean;
}): {
  audio: JSZip.JSZipObject;
  audioMimeType: string;
  graphics?: JSZip.JSZipObject;
  warnings: string[];
} => {
  const allEntries = Object.values(zip.files).filter((entry) => !entry.dir);
  const audioEntries = allEntries.filter((entry) =>
    isLikelySupportedAudio({ name: entry.name }),
  );
  const graphicsEntries = allEntries.filter((entry) =>
    /\.cdg$/iu.test(entry.name),
  );
  const warnings: string[] = [];

  if (!audioEntries.length) {
    throw new LoaderError({
      code: 'KARAOKE_FILES_MISSING',
      message: 'Expected at least one supported audio file in archive.',
      retriable: false,
    });
  }

  if (audioEntries.length > 1) {
    if (strictValidation) {
      throw new LoaderError({
        code: 'MULTIPLE_AUDIO_TRACKS',
        message:
          'Multiple supported audio files found and strict validation is enabled.',
        retriable: false,
      });
    }
    warnings.push('Multiple supported audio files found; selected best match.');
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

  const sortedAudioEntries = [...audioEntries].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  let audio = sortedAudioEntries.at(0);
  const graphics = graphicsEntries.at(0);

  if (graphics) {
    const graphicsStem = stemFromName({ name: graphics.name });
    const matchingAudio = sortedAudioEntries.find(
      (entry) => stemFromName({ name: entry.name }) === graphicsStem,
    );
    if (matchingAudio) {
      audio = matchingAudio;
    }
  }

  if (!audio) {
    throw new LoaderError({
      code: 'AUDIO_UNREADABLE',
      message: 'Unable to select supported audio payload from archive.',
      retriable: false,
    });
  }

  const extension = extensionFromName({ name: audio.name });
  const audioMimeType = inferMimeTypeFromExtension({ extension });

  return {
    audio,
    audioMimeType,
    ...(graphics ? { graphics } : {}),
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
      const sourceSummary = fileNameFromInput({ input });
      const sourceMimeType =
        input.kind === 'file'
          ? input.file.type
          : input.kind === 'blob'
            ? input.blob.type
            : undefined;

      const payloadBuffer = await asArrayBuffer({
        input,
        signal: controller.signal,
      });
      logger.debug({
        message: 'load:payload-read',
        bytes: payloadBuffer.byteLength,
      });

      const zip = await JSZip.loadAsync(payloadBuffer).catch(() => null);

      if (!zip) {
        if (
          !isLikelySupportedAudio({
            name: sourceSummary,
            ...(sourceMimeType ? { mimeType: sourceMimeType } : {}),
          })
        ) {
          throw new LoaderError({
            code: 'AUDIO_FORMAT_UNSUPPORTED',
            message:
              'Input is neither a valid zip archive nor a supported audio file.',
            retriable: false,
            context: {
              source: sourceSummary,
              details: sourceMimeType ?? 'unknown-mime',
            },
          });
        }

        const audioMimeType = sourceMimeType?.startsWith('audio/')
          ? sourceMimeType
          : inferMimeTypeFromExtension({
              extension: extensionFromName({ name: sourceSummary }),
            });

        const fallbackMetadata = metadataFromName({ name: sourceSummary });
        const embeddedMetadata = await readMetadataFromAudio({
          audioBuffer: payloadBuffer,
          audioMimeType,
        });

        const metadata = mergeMetadata({
          preferred: embeddedMetadata,
          fallback: fallbackMetadata,
        });

        return {
          trackId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          sourceSummary,
          audioBuffer: payloadBuffer,
          audioMimeType,
          hasGraphics: false,
          cdgBytes: null,
          metadata,
          warnings: [],
        };
      }

      const selection = getTrackEntries({
        zip,
        strictValidation: options.strictValidation ?? false,
      });
      logger.debug({
        message: 'load:entries-selected',
        audio: selection.audio.name,
        graphics: selection.graphics?.name ?? null,
        warnings: selection.warnings,
      });

      const audioBuffer = await selection.audio
        .async('arraybuffer')
        .catch((causeValue: unknown) => {
          throw new LoaderError({
            code: 'AUDIO_UNREADABLE',
            message: 'Unable to read audio payload from archive.',
            retriable: false,
            causeValue,
          });
        });

      const cdgBytes = selection.graphics
        ? await selection.graphics
            .async('uint8array')
            .catch((causeValue: unknown) => {
              throw new LoaderError({
                code: 'GRAPHICS_UNREADABLE',
                message: 'Unable to read cdg payload from archive.',
                retriable: false,
                causeValue,
              });
            })
        : null;

      const fallbackMetadata = metadataFromName({ name: selection.audio.name });
      const embeddedMetadata = await readMetadataFromAudio({
        audioBuffer,
        audioMimeType: selection.audioMimeType,
      });
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
        cdgBytes: cdgBytes?.byteLength ?? 0,
        metadata,
      });
      return {
        trackId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        sourceSummary,
        audioBuffer,
        audioMimeType: selection.audioMimeType,
        hasGraphics: cdgBytes !== null,
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
      const inputName = fileNameFromInput({ input });
      const inputMimeType =
        input.kind === 'file'
          ? input.file.type
          : input.kind === 'blob'
            ? input.blob.type
            : undefined;

      return {
        karaokeLikely: false,
        audioLikely: isLikelySupportedAudio({
          name: inputName,
          ...(inputMimeType ? { mimeType: inputMimeType } : {}),
        }),
        discoveredEntries: [],
        hasExtraEntries: false,
        extensionCaseIssues: false,
      };
    }

    const names = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name);

    const audioEntries = names.filter((name) =>
      isLikelySupportedAudio({ name }),
    );
    const karaokeEntries = names.filter(
      (name) => isLikelySupportedAudio({ name }) || /\.cdg$/iu.test(name),
    );
    const lowerCasedMismatches = names.some((name) =>
      /\.(MP3|AAC|M4A|MP4|OGG|OPUS|WAV|WEBM|FLAC|CDG)$/u.test(name),
    );

    logger.debug({
      message: 'probe:result',
      entryCount: names.length,
      karaokeEntries: karaokeEntries.length,
      extensionCaseIssues: lowerCasedMismatches,
    });

    return {
      karaokeLikely: karaokeEntries.length >= 2,
      audioLikely: audioEntries.length > 0,
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
