/** Supported loader input sources. */
export type LoaderInput =
  | { kind: 'url'; url: string }
  | { kind: 'file'; file: File }
  | { kind: 'blob'; blob: Blob }
  | { kind: 'arrayBuffer'; arrayBuffer: ArrayBuffer };

/** Optional settings for load/probe operations. */
export interface LoaderOptions {
  signal?: AbortSignal;
  requestId?: string;
  strictValidation?: boolean;
  debug?: boolean;
}

/**
 * Lightweight probe output for preflight checks.
 * `karaokeLikely` indicates a likely audio+graphics karaoke archive shape.
 * `audioLikely` indicates the input likely contains browser-playable audio,
 * including raw audio payloads that are not zip archives.
 */
export interface LoaderProbeResult {
  karaokeLikely: boolean;
  audioLikely: boolean;
  discoveredEntries: readonly string[];
  hasExtraEntries: boolean;
  extensionCaseIssues: boolean;
}

/** Basic metadata parsed/derived for loaded tracks. */
export interface LoaderMetadata {
  title: string;
  artist: string;
  album: string;
}

/** Primary media category for the loaded track payload. */
export type LoadedTrackMediaKind = 'audio' | 'video';

/**
 * Successful load payload consumed by player runtime.
 * `mediaMimeType` is used when binding the in-memory media blob to <audio>/<video>.
 * `mediaKind` identifies whether the payload should be attached to audio or video stage output.
 * `hasGraphics` indicates whether a CDG graphics stream is available.
 * `cdgBytes` is null for audio-only tracks.
 */
export interface LoadedTrack {
  trackId: string;
  sourceSummary: string;
  audioBuffer: ArrayBuffer;
  mediaKind: LoadedTrackMediaKind;
  mediaMimeType: string;
  /** @deprecated Prefer mediaMimeType. Kept for backward compatibility. */
  audioMimeType: string;
  hasGraphics: boolean;
  cdgBytes: Uint8Array | null;
  metadata: LoaderMetadata;
  warnings: readonly string[];
}

/** Canonical loader error codes surfaced by package APIs. */
export type LoaderErrorCode =
  | 'INPUT_UNSUPPORTED'
  | 'FETCH_FAILED'
  | 'ARCHIVE_INVALID'
  | 'KARAOKE_FILES_MISSING'
  | 'MULTIPLE_AUDIO_TRACKS'
  | 'MULTIPLE_GRAPHICS_TRACKS'
  | 'AUDIO_FORMAT_UNSUPPORTED'
  | 'AUDIO_UNREADABLE'
  | 'GRAPHICS_UNREADABLE'
  | 'ABORTED'
  | 'INTERNAL';

/** Extra troubleshooting context attached to LoaderError values. */
export interface LoaderErrorContext {
  source?: string;
  details?: string;
}
