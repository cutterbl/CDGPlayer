import {
  CDGPlayer,
  HEIGHT,
  WIDTH,
  type CdgRenderContext,
} from '@cxing/cdg-core';
import {
  createLoader,
  type CdgLoader,
  LoaderError,
  type LoadedTrack,
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

/**
 * Package-local debug logger.
 */
const debugLog = (...args: unknown[]): void => {
  console.log('[cdg-player]', ...args);
};

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
  loader?: CdgLoader;
  renderMode?: 'auto' | 'main-thread' | 'worker';
  loadTransport?: 'auto' | 'main-thread' | 'worker';
  audioEngineMode?: PlayerAudioEngineMode;
}

/** Event detail payload for statechange events. */
export interface PlayerStateChangeDetail {
  previous: PlayerState;
  next: PlayerState;
}

type CdgCorePlayerAsyncLoad = CDGPlayer & {
  loadAsync?: (args: { data: Uint8Array }) => Promise<CDGPlayer>;
};

const createInitialState = (): PlayerState => ({
  status: 'idle',
  trackId: null,
  currentTimeMs: 0,
  durationMs: 0,
  volume: 1,
  playbackRate: 1,
  pitchSemitones: 0,
});

const clamp = ({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number => Math.min(max, Math.max(min, value));

const asMilliseconds = ({ seconds }: { seconds: number }): number =>
  Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds * 1000)) : 0;

/**
 * High-level karaoke player that orchestrates loading, audio, and CDG rendering.
 */
export class CdgPlayer extends EventTarget {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly audio: HTMLAudioElement;
  private readonly loader: CdgLoader;
  private readonly ownsLoader: boolean;
  private readonly loadTransport: 'auto' | 'main-thread' | 'worker';
  private readonly cdgPlayer: CDGPlayer;
  private readonly renderer: CdgRenderer;
  private readonly audioEngine: CdgAudioEngine;

  private state: PlayerState = createInitialState();
  private currentObjectUrl: string | null = null;

  /**
   * Creates a player bound to canvas/audio elements and optional strategy overrides.
   */
  constructor({
    canvas,
    audio,
    loader,
    renderMode = 'auto',
    loadTransport = 'auto',
    audioEngineMode = 'auto',
  }: CdgPlayerOptions) {
    super();
    this.canvas = canvas;
    this.audio = audio;
    this.loader = loader ?? createLoader();
    this.ownsLoader = !loader;
    this.loadTransport = loadTransport;

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
      audio: this.audio,
      mode: audioEngineMode,
    });

    this.cdgPlayer = new CDGPlayer({
      afterRender: (renderContext: CdgRenderContext) => {
        this.renderer.render({ renderContext });
      },
    });

    this.audio.preload = 'auto';
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('play', this.handlePlay);
    this.audio.addEventListener('pause', this.handlePause);
    this.audio.addEventListener('ended', this.handleEnded);
  }

  /**
   * Returns immutable player state snapshot.
   */
  getState(): Readonly<PlayerState> {
    return this.state;
  }

  /**
   * Loads karaoke assets and prepares playback.
   */
  async load({
    input,
    loaderOptions,
    autoplay = false,
  }: PlayerLoadOptions): Promise<LoadedTrack> {
    this.applyState({ status: 'loading' });
    debugLog('load:start', {
      inputKind: input.kind,
      loadTransport: this.loadTransport,
      autoplay,
    });

    try {
      const useWorkerLoader = this.shouldUseWorkerLoader();
      debugLog('load:transport-selected', {
        useWorkerLoader,
        loadTransport: this.loadTransport,
      });
      let loadedTrack: LoadedTrack;

      if (useWorkerLoader) {
        try {
          loadedTrack = await loadInWorker({
            input,
            ...(loaderOptions ? { options: loaderOptions } : {}),
          });
          debugLog('load:worker-success', {
            trackId: loadedTrack.trackId,
            sourceSummary: loadedTrack.sourceSummary,
          });
        } catch (errorValue: unknown) {
          debugLog('load:worker-error', errorValue);
          if (!this.shouldFallbackToMainThreadLoad({ errorValue })) {
            throw errorValue;
          }

          debugLog('load:fallback-main-thread');

          loadedTrack = await this.loader.load({
            input,
            ...(loaderOptions ? { options: loaderOptions } : {}),
          });
          debugLog('load:main-thread-success-after-fallback', {
            trackId: loadedTrack.trackId,
            sourceSummary: loadedTrack.sourceSummary,
          });
        }
      } else {
        loadedTrack = await this.loader.load({
          input,
          ...(loaderOptions ? { options: loaderOptions } : {}),
        });
        debugLog('load:main-thread-success', {
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

      debugLog('load:ready', {
        trackId: loadedTrack.trackId,
      });

      return loadedTrack;
    } catch (errorValue: unknown) {
      debugLog('load:error', errorValue);
      this.applyState({ status: 'error' });
      this.dispatchEvent(new CustomEvent('error', { detail: { errorValue } }));
      throw errorValue;
    }
  }

  /**
   * Starts playback and frame advancement.
   */
  async play(): Promise<void> {
    await this.audioEngine.play();
    this.cdgPlayer.play();
    this.applyState({ status: 'playing' });
  }

  /**
   * Pauses playback and frame advancement.
   */
  pause(): void {
    this.audioEngine.pause();
    this.cdgPlayer.stop();

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
    this.cdgPlayer.reset().render();
    this.applyState({
      status: this.state.trackId ? 'ready' : 'idle',
      currentTimeMs: 0,
    });
  }

  /**
   * Seeks by percentage of track duration.
   */
  seek({ percentage }: { percentage: number }): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      return;
    }

    const clampedPercentage = clamp({ value: percentage, min: 0, max: 100 });
    const targetSeconds = (clampedPercentage / 100) * this.audio.duration;
    this.audio.currentTime = targetSeconds;
    this.cdgPlayer.sync({ ms: asMilliseconds({ seconds: targetSeconds }) });
    this.applyState({
      currentTimeMs: asMilliseconds({ seconds: targetSeconds }),
    });
  }

  /**
   * Sets playback output volume.
   */
  setVolume({ value }: { value: number }): void {
    const nextVolume = clamp({ value, min: 0, max: 1 });
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
    const nextTempo = clamp({ value, min: 0.5, max: 2 });
    this.audioEngine.setTempo({ value: nextTempo });
    this.applyState({ playbackRate: nextTempo });
  }

  /**
   * Sets key shift in semitones.
   */
  setPitchSemitones({ value }: { value: number }): void {
    const nextPitchSemitones = Math.round(clamp({ value, min: -24, max: 24 }));
    this.audioEngine.setPitchSemitones({ value: nextPitchSemitones });
    this.applyState({ pitchSemitones: nextPitchSemitones });
  }

  /**
   * Releases player resources and event listeners.
   */
  dispose(): void {
    this.stop();
    this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.removeEventListener('play', this.handlePlay);
    this.audio.removeEventListener('pause', this.handlePause);
    this.audio.removeEventListener('ended', this.handleEnded);
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
    this.releaseObjectUrl();
    debugLog('attach:start', {
      trackId: loadedTrack.trackId,
      cdgBytes: loadedTrack.cdgBytes.byteLength,
      audioBytes: loadedTrack.audioBuffer.byteLength,
    });

    const corePlayer = this.cdgPlayer as CdgCorePlayerAsyncLoad;
    if (typeof corePlayer.loadAsync === 'function') {
      debugLog('attach:core-loadAsync');
      await corePlayer.loadAsync({ data: loadedTrack.cdgBytes });
    } else {
      debugLog('attach:core-load-sync');
      this.cdgPlayer.load({ data: loadedTrack.cdgBytes });
    }

    this.cdgPlayer.reset().render();

    const audioBlob = new Blob([loadedTrack.audioBuffer], {
      type: 'audio/mpeg',
    });
    this.currentObjectUrl = URL.createObjectURL(audioBlob);
    this.audio.src = this.currentObjectUrl;
    this.audio.load();
    debugLog('attach:audio-bound', {
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
    const timeMs = asMilliseconds({ seconds: this.audio.currentTime });
    const durationMs = asMilliseconds({ seconds: this.audio.duration });
    this.cdgPlayer.sync({ ms: timeMs });
    this.applyState({ currentTimeMs: timeMs, durationMs });
  };

  private handlePlay = (): void => {
    this.cdgPlayer.play();
    this.applyState({ status: 'playing' });
  };

  private handlePause = (): void => {
    this.cdgPlayer.stop();

    if (this.state.status !== 'error' && this.state.status !== 'idle') {
      this.applyState({ status: 'paused' });
    }
  };

  private handleEnded = (): void => {
    this.cdgPlayer.stop();
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
