import JSZip from 'jszip';
import { read as readMediaTags } from 'jsmediatags';
import { createScopedLogger } from '@cxing/logger';
import { LoaderError } from './errors.js';
import {
  canBrowserPlayMedia,
  classifyMediaKind,
  extensionFromName,
  fileNameFromInput,
  inferMimeTypeFromExtension,
  isLikelySupportedMedia,
  metadataFromName,
  stemFromName,
} from './utils/loader.public-functions.js';
import {
  hasAnyEmbeddedMetadata,
  mergeMetadata,
} from './utils/loader.internal-functions.js';
import type {
  LoadedTrack,
  LoadedTrackMediaKind,
  LoaderInput,
  LoaderMetadata,
  LoaderOptions,
  LoaderProbeResult,
} from './types.js';

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
  media: JSZip.JSZipObject;
  mediaKind: LoadedTrackMediaKind;
  mediaMimeType: string;
  graphics?: JSZip.JSZipObject;
  warnings: string[];
} => {
  const allEntries = Object.values(zip.files).filter((entry) => !entry.dir);
  const mediaEntries = allEntries.filter((entry) =>
    isLikelySupportedMedia({ name: entry.name }),
  );
  const graphicsEntries = allEntries.filter((entry) =>
    /\.cdg$/iu.test(entry.name),
  );
  const warnings: string[] = [];

  if (!mediaEntries.length) {
    throw new LoaderError({
      code: 'KARAOKE_FILES_MISSING',
      message: 'Expected at least one supported media file in archive.',
      retriable: false,
    });
  }

  if (mediaEntries.length > 1) {
    if (strictValidation) {
      throw new LoaderError({
        code: 'MULTIPLE_AUDIO_TRACKS',
        message:
          'Multiple supported media files found and strict validation is enabled.',
        retriable: false,
      });
    }
    warnings.push('Multiple supported media files found; selected best match.');
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

  const sortedMediaEntries = [...mediaEntries].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  let media = sortedMediaEntries.at(0);
  const graphics = graphicsEntries.at(0);

  if (graphics) {
    const graphicsStem = stemFromName({ name: graphics.name });
    const matchingAudio = sortedMediaEntries.find((entry) => {
      const extension = extensionFromName({ name: entry.name });
      const mediaKind = classifyMediaKind({ extension });
      return (
        mediaKind === 'audio' &&
        stemFromName({ name: entry.name }) === graphicsStem
      );
    });
    if (matchingAudio) {
      media = matchingAudio;
    }
  }

  if (!media) {
    throw new LoaderError({
      code: 'AUDIO_UNREADABLE',
      message: 'Unable to select supported media payload from archive.',
      retriable: false,
    });
  }

  const extension = extensionFromName({ name: media.name });
  const mediaKind = classifyMediaKind({ extension });
  if (!mediaKind) {
    throw new LoaderError({
      code: 'AUDIO_FORMAT_UNSUPPORTED',
      message: 'Unable to determine media kind for selected archive entry.',
      retriable: false,
      context: { source: media.name },
    });
  }

  const mediaMimeType = inferMimeTypeFromExtension({
    extension,
    kind: mediaKind,
  });
  const graphicsForMedia = mediaKind === 'audio' ? graphics : undefined;

  if (graphics && mediaKind === 'video') {
    warnings.push('Ignoring cdg graphics because selected media is video.');
  }

  return {
    media,
    mediaKind,
    mediaMimeType,
    ...(graphicsForMedia ? { graphics: graphicsForMedia } : {}),
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
        const sourceExtension = extensionFromName({ name: sourceSummary });
        const mediaKind = classifyMediaKind({
          mimeType: sourceMimeType,
          extension: sourceExtension,
        });

        if (
          !isLikelySupportedMedia({
            name: sourceSummary,
            ...(sourceMimeType ? { mimeType: sourceMimeType } : {}),
          })
        ) {
          throw new LoaderError({
            code: 'AUDIO_FORMAT_UNSUPPORTED',
            message:
              'Input is neither a valid zip archive nor a supported media file.',
            retriable: false,
            context: {
              source: sourceSummary,
              details: sourceMimeType ?? 'unknown-mime',
            },
          });
        }

        if (!mediaKind) {
          throw new LoaderError({
            code: 'AUDIO_FORMAT_UNSUPPORTED',
            message: 'Unable to determine media kind for input payload.',
            retriable: false,
            context: {
              source: sourceSummary,
              details: sourceMimeType ?? sourceExtension ?? 'unknown-extension',
            },
          });
        }

        const mediaMimeType =
          sourceMimeType?.startsWith('audio/') ||
          sourceMimeType?.startsWith('video/')
            ? sourceMimeType
            : inferMimeTypeFromExtension({
                extension: sourceExtension,
                kind: mediaKind,
              });

        if (
          !canBrowserPlayMedia({ mimeType: mediaMimeType, kind: mediaKind })
        ) {
          throw new LoaderError({
            code: 'AUDIO_FORMAT_UNSUPPORTED',
            message: `This browser cannot play ${mediaKind} format ${mediaMimeType}.`,
            retriable: false,
            context: {
              source: sourceSummary,
              details: mediaMimeType,
            },
          });
        }

        const fallbackMetadata = metadataFromName({ name: sourceSummary });
        const embeddedMetadata =
          mediaKind === 'audio'
            ? await readMetadataFromAudio({
                audioBuffer: payloadBuffer,
                audioMimeType: mediaMimeType,
              })
            : {};

        const metadata = mergeMetadata({
          preferred: embeddedMetadata,
          fallback: fallbackMetadata,
        });

        return {
          trackId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          sourceSummary,
          audioBuffer: payloadBuffer,
          mediaKind,
          mediaMimeType,
          audioMimeType: mediaMimeType,
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
        media: selection.media.name,
        mediaKind: selection.mediaKind,
        mediaMimeType: selection.mediaMimeType,
        graphics: selection.graphics?.name ?? null,
        warnings: selection.warnings,
      });

      const audioBuffer = await selection.media
        .async('arraybuffer')
        .catch((causeValue: unknown) => {
          throw new LoaderError({
            code: 'AUDIO_UNREADABLE',
            message: 'Unable to read media payload from archive.',
            retriable: false,
            causeValue,
          });
        });

      if (
        !canBrowserPlayMedia({
          mimeType: selection.mediaMimeType,
          kind: selection.mediaKind,
        })
      ) {
        throw new LoaderError({
          code: 'AUDIO_FORMAT_UNSUPPORTED',
          message: `This browser cannot play ${selection.mediaKind} format ${selection.mediaMimeType}.`,
          retriable: false,
          context: {
            source: selection.media.name,
            details: selection.mediaMimeType,
          },
        });
      }

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

      const fallbackMetadata = metadataFromName({ name: selection.media.name });
      const embeddedMetadata =
        selection.mediaKind === 'audio'
          ? await readMetadataFromAudio({
              audioBuffer,
              audioMimeType: selection.mediaMimeType,
            })
          : {};
      if (!hasAnyEmbeddedMetadata({ metadata: embeddedMetadata })) {
        logger.info({
          message: 'metadata:fallback-filename',
          sourceSummary,
          mediaEntry: selection.media.name,
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
        mediaKind: selection.mediaKind,
        mediaMimeType: selection.mediaMimeType,
        audioMimeType: selection.mediaMimeType,
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
        audioLikely: isLikelySupportedMedia({
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
      isLikelySupportedMedia({ name }),
    );
    const karaokeEntries = names.filter(
      (name) => isLikelySupportedMedia({ name }) || /\.cdg$/iu.test(name),
    );
    const lowerCasedMismatches = names.some((name) =>
      /\.(MP3|AAC|M4A|MP4|OGG|OPUS|WAV|WEBM|FLAC|MOV|M4V|MKV|AVI|CDG)$/u.test(
        name,
      ),
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
