import type { LoaderMetadata } from '../types.js';

export const hasAnyEmbeddedMetadata = ({
  metadata,
}: {
  metadata: Partial<LoaderMetadata>;
}): boolean => {
  return Boolean(metadata.title || metadata.artist || metadata.album);
};

export const mergeMetadata = ({
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
