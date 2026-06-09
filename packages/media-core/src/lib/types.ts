/**
 * Byte-addressable input accepted by parser and loader APIs.
 */
export type ByteLike = ArrayLike<number>;

/**
 * Animation frame identifier compatible with browser RAF and timeout fallback.
 */
export type AnimationFrameHandle = number | ReturnType<typeof setTimeout>;

/**
 * Parser capability identification result.
 */
export interface MediaParserIdentifyResult {
  /** Whether this parser recognises the given byte sequence. */
  canParse: boolean;
  /** Confidence score between 0 and 1 where 1 is certain. */
  confidence: number;
}

/**
 * Contract that every format-specific parser package must satisfy.
 *
 * Implementations live in dedicated packages (e.g. `@cxing/media-parser-cdg`).
 * The loader uses this interface to select the correct parser at runtime
 * without depending on any format-specific package directly.
 */
export interface IMediaParser {
  /**
   * Inspect the leading bytes and report whether this parser can handle the format.
   */
  identify(args: { bytes: ByteLike }): MediaParserIdentifyResult;

  /**
   * Report any diagnostic issues found during parsing or execution.
   */
  reportDiagnostics(): readonly string[];
}
