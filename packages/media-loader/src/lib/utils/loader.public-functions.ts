import {
  SUPPORTED_AUDIO_EXTENSION_SET,
  SUPPORTED_VIDEO_EXTENSION_SET,
} from './loader.constants.js';
import type {
  LoadedTrackMediaKind,
  LoaderInput,
  LoaderMetadata,
} from '../types.js';

export const extensionFromName = ({
  name,
}: {
  name: string;
}): string | null => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === name.length - 1) {
    return null;
  }

  return name.slice(dotIndex + 1).toLowerCase();
};

export const baseNameFromPath = ({ name }: { name: string }): string => {
  const slashIndex = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  return slashIndex >= 0 ? name.slice(slashIndex + 1) : name;
};

export const stemFromName = ({ name }: { name: string }): string => {
  const baseName = baseNameFromPath({ name });
  const dotIndex = baseName.lastIndexOf('.');
  return dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
};

export const inferMimeTypeFromExtension = ({
  extension,
  kind,
}: {
  extension: string | null;
  kind: LoadedTrackMediaKind;
}): string => {
  switch (extension) {
    case 'mp3':
      return 'audio/mpeg';
    case 'aac':
      return 'audio/aac';
    case 'm4a':
      return 'audio/mp4';
    case 'mp4':
      return kind === 'video' ? 'video/mp4' : 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'opus':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return kind === 'video' ? 'video/webm' : 'audio/webm';
    case 'flac':
      return 'audio/flac';
    case 'mov':
      return 'video/quicktime';
    case 'm4v':
      return 'video/mp4';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    default:
      return kind === 'video' ? 'video/mp4' : 'audio/mpeg';
  }
};

export const classifyMediaKind = ({
  mimeType,
  extension,
}: {
  mimeType?: string | undefined;
  extension: string | null;
}): LoadedTrackMediaKind | null => {
  const normalizedMime = (mimeType ?? '').trim().toLowerCase();

  if (normalizedMime.startsWith('video/')) {
    return 'video';
  }

  if (normalizedMime.startsWith('audio/')) {
    return 'audio';
  }

  if (!extension) {
    return null;
  }

  if (SUPPORTED_VIDEO_EXTENSION_SET.has(extension)) {
    return 'video';
  }

  if (SUPPORTED_AUDIO_EXTENSION_SET.has(extension)) {
    return 'audio';
  }

  return null;
};

export const isLikelySupportedMedia = ({
  name,
  mimeType,
}: {
  name: string;
  mimeType?: string;
}): boolean => {
  const extension = extensionFromName({ name });
  return classifyMediaKind({ mimeType, extension }) !== null;
};

export const canBrowserPlayMedia = ({
  mimeType,
  kind,
}: {
  mimeType: string;
  kind: LoadedTrackMediaKind;
}): boolean => {
  if (typeof document === 'undefined') {
    return true;
  }

  const element = document.createElement(kind === 'video' ? 'video' : 'audio');
  const result = element.canPlayType(mimeType);
  return result === 'probably' || result === 'maybe';
};

export const fileNameFromInput = ({
  input,
}: {
  input: LoaderInput;
}): string => {
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

export const metadataFromName = ({
  name,
}: {
  name: string;
}): LoaderMetadata => {
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
