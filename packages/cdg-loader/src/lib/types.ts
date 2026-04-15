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

/** Lightweight probe output for archive preflight checks. */
export interface LoaderProbeResult {
  karaokeLikely: boolean;
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

/** Successful load payload consumed by player runtime. */
export interface LoadedTrack {
  trackId: string;
  sourceSummary: string;
  audioBuffer: ArrayBuffer;
  cdgBytes: Uint8Array;
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
  | 'AUDIO_UNREADABLE'
  | 'GRAPHICS_UNREADABLE'
  | 'ABORTED'
  | 'INTERNAL';

/** Extra troubleshooting context attached to LoaderError values. */
export interface LoaderErrorContext {
  source?: string;
  details?: string;
}
