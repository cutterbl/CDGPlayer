export const SUPPORTED_AUDIO_EXTENSIONS = [
  'mp3',
  'aac',
  'm4a',
  'mp4',
  'ogg',
  'opus',
  'wav',
  'webm',
  'flac',
] as const;

export const SUPPORTED_VIDEO_EXTENSIONS = [
  'mp4',
  'webm',
  'mov',
  'm4v',
  'mkv',
  'avi',
] as const;

export const SUPPORTED_AUDIO_EXTENSION_SET = new Set<string>(
  SUPPORTED_AUDIO_EXTENSIONS,
);

export const SUPPORTED_VIDEO_EXTENSION_SET = new Set<string>(
  SUPPORTED_VIDEO_EXTENSIONS,
);
