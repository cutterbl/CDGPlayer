declare module 'jsmediatags' {
  export interface MediaTagReadError {
    type?: string;
    info?: string;
  }

  export interface MediaTagReadResult {
    tags?: Record<string, unknown>;
  }

  export interface MediaTagReadCallbacks {
    onSuccess: (tag: MediaTagReadResult) => void;
    onError?: (error: MediaTagReadError) => void;
  }

  export function read(
    location: string | Blob | File | ArrayBuffer | ArrayLike<number>,
    callbacks: MediaTagReadCallbacks,
  ): void;
}
