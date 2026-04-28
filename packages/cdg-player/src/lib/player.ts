import {
  CDGPlayer,
  HEIGHT,
  WIDTH,
  type CdgRenderContext,
} from '@cxing/cdg-core';
import { createScopedLogger } from '@cxing/logger';
import {
  createLoader,
  type CdgLoader,
  LoaderError,
  type LoadedTrack,
  type LoadedTrackMediaKind,
  type LoaderInput,
  type LoaderOptions,
  loadInWorker,
} from '@cxing/cdg-loader';
import { createRenderer, type CdgRenderer } from './renderer.js';
import {
  createAudioEngine,
  type CdgAudioEngine,
  type PlayerAudioEngineMode,
} from './audio-engine.js';
import {
  MAX_PITCH_SEMITONES,
  MAX_SEEK_PERCENT,
  MAX_TEMPO,
  MAX_VOLUME,
  MIN_PITCH_SEMITONES,
  MIN_SEEK_PERCENT,
  MIN_TEMPO,
  MIN_VOLUME,
} from './utils/player.constants.js';
import {
  asMilliseconds,
  canElementPlayMimeType,
  clamp,
  createInitialState,
} from './utils/player.functions.js';

/** Playback lifecycle states for high-level player consumers. */
export type PlayerStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'error';

/** Snapshot of externally observable player state. */
export interface PlayerState {
  status: PlayerStatus;
  trackId: string | null;
  currentTimeMs: number;
  durationMs: number;
  volume: number;
  playbackRate: number;
  pitchSemitones: number;
}

/** Input options for load requests. */
export interface PlayerLoadOptions {
  input: LoaderInput;
  loaderOptions?: LoaderOptions;
  autoplay?: boolean;
}

/** Construction options for CdgPlayer runtime wrapper. */
export interface CdgPlayerOptions {
  canvas: HTMLCanvasElement;
  audio: HTMLAudioElement;
  video?: HTMLVideoElement;
  loader?: CdgLoader;
  debug?: boolean;
  renderMode?: 'auto' | 'main-thread' | 'worker';
  loadTransport?: 'auto' | 'main-thread' | 'worker';
  audioEngineMode?: PlayerAudioEngineMode;
}

/** Event detail payload for `statechange` events. */
export interface PlayerStateChangeDetail {
  previous: PlayerState;
  next: PlayerState;
}

type CdgCorePlayerAsyncLoad = CDGPlayer & {
  loadAsync?: (args: { data: Uint8Array }) => Promise<CDGPlayer>;
};

/**
 * High-level karaoke player that orchestrates loading and audio playback.
 * CDG rendering/synchronization are enabled only when the loaded track includes
 * a graphics stream.
 */
export class CdgPlayer extends EventTarget {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly audio: HTMLAudioElement;
  private readonly video: HTMLVideoElement | null;
  private readonly loader: CdgLoader;
  private readonly ownsLoader: boolean;
  private readonly logger: ReturnType<typeof createScopedLogger>;
  private readonly debug: boolean;
  private readonly loadTransport: 'auto' | 'main-thread' | 'worker';
  private readonly cdgPlayer: CDGPlayer;
  private readonly renderer: CdgRenderer;
  private readonly audioEngineMode: PlayerAudioEngineMode;

  private audioEngine: CdgAudioEngine;
  private activeMedia: HTMLMediaElement;
  private activeMediaKind: LoadedTrackMediaKind = 'audio';

  private state: PlayerState = createInitialState();
  private currentObjectUrl: string | null = null;
  private hasGraphicsTrack = false;

  /**
   * Creates a player bound to canvas/audio elements and optional strategy overrides.
   */
  constructor({
    canvas,
    audio,
    video,
    loader,
    debug = false,
    renderMode = 'auto',
    loadTransport = 'auto',
    audioEngineMode = 'auto',
  }: CdgPlayerOptions) {
    super();
    this.canvas = canvas;
    this.audio = audio;
    this.video = video ?? null;
    this.debug = debug;
    this.logger = createScopedLogger({ scope: 'cdg-player', debug });
    this.loader = loader ?? createLoader({ debug });
    this.ownsLoader = !loader;
    this.loadTransport = loadTransport;
    this.audioEngineMode = audioEngineMode;
    this.activeMedia = this.audio;

    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;

    const resolvedContext = this.canvas.getContext('2d');
    if (!resolvedContext) {
      throw new Error('Unable to create 2D context for karaoke player canvas.');
    }

    this.ctx = resolvedContext;
    this.ctx.imageSmoothingEnabled = false;

    this.renderer = createRenderer({
      mode: renderMode,
      canvas: this.canvas,
      ctx: this.ctx,
    });

    this.audioEngine = createAudioEngine({
      media: this.activeMedia,
      mode: audioEngineMode,
    });

    this.cdgPlayer = new CDGPlayer({
      afterRender: (renderContext: CdgRenderContext) => {
        this.renderer.render({ renderContext });
      },
    });

    this.audio.preload = 'auto';
    if (this.video) {
      this.video.preload = 'auto';
      this.video.controls = false;
      this.video.playsInline = true;
    }

    this.bindMediaListeners({ media: this.activeMedia });
  }

  /**
   * Returns immutable player state snapshot.
   */
  getState(): Readonly<PlayerState> {
    return this.state;
  }

  /**
   * Loads track assets and prepares playback for either karaoke (audio+graphics)
   * or audio-only content.
   */
  async load({
    input,
    loaderOptions,
    autoplay = false,
  }: PlayerLoadOptions): Promise<LoadedTrack> {
    this.applyState({ status: 'loading' });
    this.logger.debug({
      message: 'load:start',
      inputKind: input.kind,
      loadTransport: this.loadTransport,
      autoplay,
    });

    try {
      const useWorkerLoader = this.shouldUseWorkerLoader();
      this.logger.debug({
        message: 'load:transport-selected',
        useWorkerLoader,
        loadTransport: this.loadTransport,
      });
      let loadedTrack: LoadedTrack;
      const effectiveLoaderOptions: LoaderOptions = {
        ...(loaderOptions ?? {}),
        debug: loaderOptions?.debug ?? this.debug,
      };

      if (useWorkerLoader) {
        try {
          loadedTrack = await loadInWorker({
            input,
            options: effectiveLoaderOptions,
          });
          this.logger.debug({
            message: 'load:worker-success',
            trackId: loadedTrack.trackId,
            sourceSummary: loadedTrack.sourceSummary,
          });
        } catch (errorValue: unknown) {
          this.logger.debug({ message: 'load:worker-error', errorValue });
          if (!this.shouldFallbackToMainThreadLoad({ errorValue })) {
            throw errorValue;
          }

          this.logger.debug({ message: 'load:fallback-main-thread' });

          loadedTrack = await this.loader.load({
            input,
            options: effectiveLoaderOptions,
          });
          this.logger.debug({
            message: 'load:main-thread-success-after-fallback',
            trackId: loadedTrack.trackId,
            sourceSummary: loadedTrack.sourceSummary,
          });
        }
      } else {
        loadedTrack = await this.loader.load({
          input,
          options: effectiveLoaderOptions,
        });
        this.logger.debug({
          message: 'load:main-thread-success',
          trackId: loadedTrack.trackId,
          sourceSummary: loadedTrack.sourceSummary,
        });
      }

      await this.attachLoadedTrack({ loadedTrack });
      this.applyState({
        status: 'ready',
        trackId: loadedTrack.trackId,
      });

      if (autoplay) {
        await this.play();
      }

      this.logger.debug({
        message: 'load:ready',
        trackId: loadedTrack.trackId,
      });

      return loadedTrack;
    } catch (errorValue: unknown) {
      this.logger.error({ message: 'load:error', errorValue });
      this.applyState({ status: 'error' });
      this.dispatchEvent(new CustomEvent('error', { detail: { errorValue } }));
      throw errorValue;
    }
  }

  /**
   * Starts media playback and, when graphics exist, advances CDG frame playback.
   */
  async play(): Promise<void> {
    await this.audioEngine.play();
    if (this.hasGraphicsTrack) {
      this.cdgPlayer.play();
    }
    this.applyState({ status: 'playing' });
  }

  /**
   * Pauses media playback and, when graphics exist, pauses CDG frame playback.
   */
  pause(): void {
    this.audioEngine.pause();
    if (this.hasGraphicsTrack) {
      this.cdgPlayer.stop();
    }

    if (this.state.status !== 'error') {
      this.applyState({ status: 'paused' });
    }
  }

  /**
   * Stops playback and rewinds to beginning.
   */
  stop(): void {
    this.pause();
    this.audioEngine.stop();
    if (this.hasGraphicsTrack) {
      this.cdgPlayer.reset().render();
    }
    this.applyState({
      status: this.state.trackId ? 'ready' : 'idle',
      currentTimeMs: 0,
    });
  }

  /**
   * Seeks by percentage of track duration and re-syncs CDG timing when graphics
   * are present.
   */
  seek({ percentage }: { percentage: number }): void {
    if (
      !Number.isFinite(this.activeMedia.duration) ||
      this.activeMedia.duration <= 0
    ) {
      return;
    }

    const clampedPercentage = clamp({
      value: percentage,
      min: MIN_SEEK_PERCENT,
      max: MAX_SEEK_PERCENT,
    });
    const targetSeconds = (clampedPercentage / 100) * this.activeMedia.duration;
    this.activeMedia.currentTime = targetSeconds;
    if (this.hasGraphicsTrack) {
      this.cdgPlayer.sync({ ms: asMilliseconds({ seconds: targetSeconds }) });
    }
    this.applyState({
      currentTimeMs: asMilliseconds({ seconds: targetSeconds }),
    });
  }

  /**
   * Sets playback output volume.
   */
  setVolume({ value }: { value: number }): void {
    const nextVolume = clamp({
      value,
      min: MIN_VOLUME,
      max: MAX_VOLUME,
    });
    this.audioEngine.setVolume({ value: nextVolume });
    this.applyState({ volume: nextVolume });
  }

  /**
   * Backward-compatible alias for tempo adjustment.
   */
  setPlaybackRate({ value }: { value: number }): void {
    this.setTempo({ value });
  }

  /**
   * Sets tempo multiplier.
   */
  setTempo({ value }: { value: number }): void {
    const nextTempo = clamp({
      value,
      min: MIN_TEMPO,
      max: MAX_TEMPO,
    });
    this.audioEngine.setTempo({ value: nextTempo });
    this.applyState({ playbackRate: nextTempo });
  }

  /**
   * Sets key shift in semitones.
   */
  setPitchSemitones({ value }: { value: number }): void {
    const nextPitchSemitones = Math.round(
      clamp({
        value,
        min: MIN_PITCH_SEMITONES,
        max: MAX_PITCH_SEMITONES,
      }),
    );
    this.audioEngine.setPitchSemitones({ value: nextPitchSemitones });
    this.applyState({ pitchSemitones: nextPitchSemitones });
  }

  /**
   * Releases player resources and event listeners.
   */
  dispose(): void {
    this.stop();
    this.unbindMediaListeners({ media: this.activeMedia });
    this.releaseObjectUrl();

    if (this.ownsLoader) {
      this.loader.dispose();
    }

    this.renderer.dispose();
    this.audioEngine.dispose();
  }

  private async attachLoadedTrack({
    loadedTrack,
  }: {
    loadedTrack: LoadedTrack;
  }): Promise<void> {
    const resolvedMediaKind: LoadedTrackMediaKind =
      loadedTrack.mediaKind ?? 'audio';
    const resolvedMediaMimeType =
      loadedTrack.mediaMimeType ?? loadedTrack.audioMimeType;

    const nextMedia = this.resolveMediaElementForTrack({ loadedTrack });

    if (this.activeMedia !== nextMedia) {
      this.unbindMediaListeners({ media: this.activeMedia });
      this.audioEngine.dispose();
      this.activeMedia = nextMedia;
      this.audioEngine = createAudioEngine({
        media: this.activeMedia,
        mode: this.audioEngineMode,
      });
      this.bindMediaListeners({ media: this.activeMedia });
    }

    this.activeMediaKind = resolvedMediaKind;
    this.releaseObjectUrl();
    this.logger.debug({
      message: 'attach:start',
      trackId: loadedTrack.trackId,
      mediaKind: resolvedMediaKind,
      mediaMimeType: resolvedMediaMimeType,
      hasGraphics: loadedTrack.hasGraphics,
      cdgBytes: loadedTrack.cdgBytes?.byteLength ?? 0,
      audioBytes: loadedTrack.audioBuffer.byteLength,
    });

    this.hasGraphicsTrack =
      loadedTrack.hasGraphics && loadedTrack.cdgBytes !== null;

    if (this.hasGraphicsTrack && loadedTrack.cdgBytes) {
      const corePlayer = this.cdgPlayer as CdgCorePlayerAsyncLoad;
      if (typeof corePlayer.loadAsync === 'function') {
        this.logger.debug({ message: 'attach:core-loadAsync' });
        await corePlayer.loadAsync({ data: loadedTrack.cdgBytes });
      } else {
        this.logger.debug({ message: 'attach:core-load-sync' });
        this.cdgPlayer.load({ data: loadedTrack.cdgBytes });
      }

      this.cdgPlayer.reset().render();
    } else {
      this.cdgPlayer.reset().render();
    }

    const mediaBlob = new Blob([loadedTrack.audioBuffer], {
      type: resolvedMediaMimeType,
    });

    if (
      resolvedMediaKind === 'video' &&
      !canElementPlayMimeType({
        media: this.activeMedia,
        mimeType: resolvedMediaMimeType,
      })
    ) {
      throw new Error(
        `This browser cannot play ${resolvedMediaKind} format ${resolvedMediaMimeType}.`,
      );
    }

    this.currentObjectUrl = URL.createObjectURL(mediaBlob);
    this.activeMedia.src = this.currentObjectUrl;
    this.activeMedia.load();

    if (resolvedMediaKind === 'video') {
      await this.waitForMediaCanPlay({
        media: this.activeMedia,
        mediaKind: resolvedMediaKind,
      });
    }

    if (this.activeMedia === this.audio && this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }

    if (this.activeMedia === this.video) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }

    this.logger.debug({
      message: 'attach:media-bound',
      mediaKind: this.activeMediaKind,
      objectUrl: this.currentObjectUrl,
    });
  }

  private releaseObjectUrl(): void {
    if (!this.currentObjectUrl) {
      return;
    }

    URL.revokeObjectURL(this.currentObjectUrl);
    this.currentObjectUrl = null;
  }

  private resolveMediaElementForTrack({
    loadedTrack,
  }: {
    loadedTrack: LoadedTrack;
  }): HTMLMediaElement {
    const resolvedMediaKind: LoadedTrackMediaKind =
      loadedTrack.mediaKind ?? 'audio';

    if (resolvedMediaKind === 'video') {
      if (!this.video) {
        throw new Error(
          'Loaded video media but no video element was provided to the player.',
        );
      }

      return this.video;
    }

    return this.audio;
  }

  private async waitForMediaCanPlay({
    media,
    mediaKind,
  }: {
    media: HTMLMediaElement;
    mediaKind: LoadedTrackMediaKind;
  }): Promise<void> {
    if (mediaKind === 'video' && media instanceof HTMLVideoElement) {
      await this.waitForVideoMetadata({ video: media });
      if (media.videoWidth <= 0 || media.videoHeight <= 0) {
        throw new Error('Video track could not be decoded by this browser.');
      }
    }

    if (media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onCanPlay = (): void => {
        cleanup();
        resolve();
      };

      const onError = (): void => {
        cleanup();
        reject(new Error(`Unable to load ${mediaKind} media in this browser.`));
      };

      const cleanup = (): void => {
        media.removeEventListener('canplay', onCanPlay);
        media.removeEventListener('error', onError);
      };

      media.addEventListener('canplay', onCanPlay, { once: true });
      media.addEventListener('error', onError, { once: true });
    });
  }

  private async waitForVideoMetadata({
    video,
  }: {
    video: HTMLVideoElement;
  }): Promise<void> {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onLoadedMetadata = (): void => {
        cleanup();
        resolve();
      };

      const onError = (): void => {
        cleanup();
        reject(new Error('Unable to read video metadata in this browser.'));
      };

      const cleanup = (): void => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata, {
        once: true,
      });
      video.addEventListener('error', onError, { once: true });
    });
  }

  private bindMediaListeners({ media }: { media: HTMLMediaElement }): void {
    media.addEventListener('timeupdate', this.handleTimeUpdate);
    media.addEventListener('play', this.handlePlay);
    media.addEventListener('pause', this.handlePause);
    media.addEventListener('ended', this.handleEnded);
  }

  private unbindMediaListeners({ media }: { media: HTMLMediaElement }): void {
    media.removeEventListener('timeupdate', this.handleTimeUpdate);
    media.removeEventListener('play', this.handlePlay);
    media.removeEventListener('pause', this.handlePause);
    media.removeEventListener('ended', this.handleEnded);
  }

  private shouldUseWorkerLoader(): boolean {
    if (this.loadTransport === 'main-thread') {
      return false;
    }

    if (this.loadTransport === 'worker') {
      return true;
    }

    if (!this.ownsLoader) {
      return false;
    }

    return typeof Worker === 'function';
  }

  private shouldFallbackToMainThreadLoad({
    errorValue,
  }: {
    errorValue: unknown;
  }): boolean {
    if (this.loadTransport !== 'auto' || !this.ownsLoader) {
      return false;
    }

    if (!(errorValue instanceof LoaderError)) {
      return true;
    }

    const loaderError = errorValue as LoaderError;
    return loaderError.code === 'INTERNAL' || loaderError.code === 'ABORTED';
  }

  private applyState(nextStatePatch: Partial<PlayerState>): void {
    const previous = this.state;
    const next = { ...previous, ...nextStatePatch };
    this.state = next;

    // `statechange` is the primary external state notification contract.
    this.dispatchEvent(
      new CustomEvent<PlayerStateChangeDetail>('statechange', {
        detail: {
          previous,
          next,
        },
      }),
    );
  }

  private handleTimeUpdate = (): void => {
    const timeMs = asMilliseconds({ seconds: this.activeMedia.currentTime });
    const durationMs = asMilliseconds({ seconds: this.activeMedia.duration });
    // Audio timeline is always tracked; CDG sync is only needed when graphics exist.
    if (this.hasGraphicsTrack) {
      this.cdgPlayer.sync({ ms: timeMs });
    }
    this.applyState({ currentTimeMs: timeMs, durationMs });
  };

  private handlePlay = (): void => {
    if (this.hasGraphicsTrack) {
      this.cdgPlayer.play();
    }
    this.applyState({ status: 'playing' });
  };

  private handlePause = (): void => {
    if (this.hasGraphicsTrack) {
      this.cdgPlayer.stop();
    }

    if (this.state.status !== 'error' && this.state.status !== 'idle') {
      this.applyState({ status: 'paused' });
    }
  };

  private handleEnded = (): void => {
    if (this.hasGraphicsTrack) {
      this.cdgPlayer.stop();
    }
    this.applyState({ status: 'ready', currentTimeMs: 0 });
  };
}

/**
 * Factory helper for constructing a CdgPlayer from named options.
 */
export const createPlayer = ({
  options,
}: {
  options: CdgPlayerOptions;
}): CdgPlayer => new CdgPlayer(options);
