import { createScopedLogger } from '@cxing/logger';

/** Audio strategy preference for player construction. */
export type PlayerAudioEngineMode = 'auto' | 'native' | 'worklet';

/** Resolved runtime audio engine mode after capability checks. */
export type ResolvedAudioEngineMode = 'native' | 'worklet';

/** Audio abstraction consumed by CdgPlayer. */
export interface CdgAudioEngine {
  readonly mode: ResolvedAudioEngineMode;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  setVolume(args: { value: number }): void;
  setTempo(args: { value: number }): void;
  setPlaybackRate(args: { value: number }): void;
  setPitchSemitones(args: { value: number }): void;
  dispose(): void;
}

type SoundTouchNodeConstructor = new (
  context: BaseAudioContext,
) => SoundTouchNodeLike;

type SoundTouchNodeModule = {
  SoundTouchNode: SoundTouchNodeConstructor & {
    register: (
      context: BaseAudioContext,
      processorUrl: string | URL,
    ) => Promise<void>;
  };
};

type SoundTouchNodeLike = AudioNode & {
  playbackRate: AudioParam;
  pitch: AudioParam;
  pitchSemitones: AudioParam;
};

const loadSoundTouchNodeModule = async (): Promise<SoundTouchNodeModule> =>
  import('@soundtouchjs/audio-worklet') as Promise<SoundTouchNodeModule>;

class NativeAudioEngine implements CdgAudioEngine {
  readonly mode = 'native' as const;

  private readonly media: HTMLMediaElement;
  private readonly logger: ReturnType<typeof createScopedLogger>;

  constructor({
    media,
    debug = false,
  }: {
    media: HTMLMediaElement;
    debug?: boolean;
  }) {
    this.media = media;
    this.logger = createScopedLogger({ scope: 'audio-engine', debug });
  }

  async play(): Promise<void> {
    this.logger.debug({
      message: 'native:play:called',
      currentTime: this.media.currentTime,
      paused: this.media.paused,
      readyState: this.media.readyState,
      src: this.media.src,
      media: this.media,
    });
    try {
      const playResult = await this.media.play();
      this.logger.debug({ message: 'native:play:resolved', playResult });
    } catch (err) {
      this.logger.debug({ message: 'native:play:error', errorValue: err });
    }
  }

  pause(): void {
    this.media.pause();
  }

  stop(): void {
    this.media.currentTime = 0;
  }

  setVolume({ value }: { value: number }): void {
    this.media.volume = value;
  }

  setTempo({ value }: { value: number }): void {
    this.media.playbackRate = value;
  }

  setPlaybackRate({ value }: { value: number }): void {
    this.setTempo({ value });
  }

  setPitchSemitones({ value }: { value: number }): void {
    void value;
    // Native element playback cannot key shift independently.
  }

  dispose(): void {
    this.logger.debug({ message: 'native:dispose' });
    // Native mode has no extra resources.
  }
}

class WorkletAudioEngine implements CdgAudioEngine {
  readonly mode = 'worklet' as const;

  private readonly media: HTMLMediaElement;
  private readonly fallback: NativeAudioEngine;
  private readonly logger: ReturnType<typeof createScopedLogger>;

  private context: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private workletNode: SoundTouchNodeLike | null = null;
  private initPromise: Promise<void> | null = null;

  constructor({
    media,
    debug = false,
  }: {
    media: HTMLMediaElement;
    debug?: boolean;
  }) {
    this.media = media;
    this.logger = createScopedLogger({ scope: 'audio-engine', debug });
    this.fallback = new NativeAudioEngine({ media, debug });
  }

  async play(): Promise<void> {
    await this.ensureInitialized();

    if (this.context) {
      this.logger.debug({
        message: 'worklet:play:context-before',
        state: this.context.state,
      });
    }
    if (this.context?.state === 'suspended') {
      await this.context.resume();
      if (this.context) {
        this.logger.debug({
          message: 'worklet:play:context-after-resume',
          state: this.context.state,
        });
      }
    }
    try {
      const playResult = await this.media.play();
      this.logger.debug({ message: 'worklet:play:resolved', playResult });
    } catch (err) {
      this.logger.debug({ message: 'worklet:play:error', errorValue: err });
    }
  }

  pause(): void {
    this.media.pause();
  }

  stop(): void {
    this.media.currentTime = 0;
  }

  setVolume({ value }: { value: number }): void {
    this.media.volume = value;
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  setTempo({ value }: { value: number }): void {
    this.media.playbackRate = value;

    if (this.workletNode) {
      this.workletNode.playbackRate.setValueAtTime(
        value,
        this.context?.currentTime ?? 0,
      );
    }
  }

  setPlaybackRate({ value }: { value: number }): void {
    this.setTempo({ value });
  }

  setPitchSemitones({ value }: { value: number }): void {
    if (this.workletNode) {
      this.workletNode.pitchSemitones.setValueAtTime(
        value,
        this.context?.currentTime ?? 0,
      );
    }
  }

  dispose(): void {
    this.logger.debug({ message: 'worklet:dispose' });
    this.workletNode?.disconnect();
    this.gainNode?.disconnect();
    this.sourceNode?.disconnect();

    this.workletNode = null;
    this.gainNode = null;
    this.sourceNode = null;

    if (this.context) {
      this.logger.debug({ message: 'worklet:dispose:close-context' });
      void this.context.close();
      this.context = null;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.context) {
      this.logger.debug({
        message: 'worklet:ensure-initialized:context-exists',
        state: this.context.state,
      });
      return;
    }

    if (this.initPromise) {
      this.logger.debug({ message: 'worklet:ensure-initialized:pending' });
      return this.initPromise;
    }

    this.initPromise = this.initializeGraph();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async initializeGraph(): Promise<void> {
    this.logger.debug({ message: 'worklet:initialize-graph:start' });
    if (typeof AudioContext !== 'function') {
      this.logger.debug({
        message: 'worklet:initialize-graph:no-audio-context',
      });
      return;
    }

    const context = new AudioContext();
    this.logger.debug({ message: 'worklet:initialize-graph:context-created' });

    try {
      if (!context.audioWorklet) {
        this.logger.debug({
          message: 'worklet:initialize-graph:no-audioworklet',
        });
        throw new Error(
          'AudioWorklet is unavailable on the current AudioContext.',
        );
      }

      const { SoundTouchNode } = await loadSoundTouchNodeModule();
      const processorUrl = new URL(
        '@soundtouchjs/audio-worklet/processor',
        import.meta.url,
      );
      await SoundTouchNode.register(context, processorUrl);
      this.logger.debug({
        message: 'worklet:initialize-graph:soundtouch-registered',
      });

      const sourceNode = context.createMediaElementSource(this.media);
      const gainNode = context.createGain();
      gainNode.gain.value = this.media.volume;
      const workletNode = new SoundTouchNode(context);

      sourceNode.connect(workletNode);
      workletNode.connect(gainNode);
      gainNode.connect(context.destination);

      const mediaElement = this.media as HTMLMediaElement & {
        preservesPitch?: boolean;
        mozPreservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };

      if (mediaElement.preservesPitch != null) {
        mediaElement.preservesPitch = false;
      }
      if (mediaElement.mozPreservesPitch != null) {
        mediaElement.mozPreservesPitch = false;
      }
      if (mediaElement.webkitPreservesPitch != null) {
        mediaElement.webkitPreservesPitch = false;
      }

      workletNode.playbackRate.setValueAtTime(
        this.media.playbackRate,
        context.currentTime,
      );
      workletNode.pitch.setValueAtTime(1, context.currentTime);
      workletNode.pitchSemitones.setValueAtTime(0, context.currentTime);

      this.context = context;
      this.sourceNode = sourceNode;
      this.gainNode = gainNode;
      this.workletNode = workletNode;
      this.logger.debug({ message: 'worklet:initialize-graph:ready' });
    } catch (err) {
      this.logger.debug({
        message: 'worklet:initialize-graph:fallback-native',
        errorValue: err,
      });
      this.fallback.setVolume({ value: this.media.volume });
      this.fallback.setPlaybackRate({ value: this.media.playbackRate });
      void context.close();
    }
  }
}

const supportsWorkletAudioEngine = (): boolean =>
  typeof AudioContext === 'function' && typeof AudioWorkletNode === 'function';

/**
 * Creates an audio engine, selecting worklet/native mode based on preference and support.
 */
export const createAudioEngine = ({
  media,
  audio,
  mode,
  debug = false,
}: {
  media?: HTMLMediaElement;
  audio?: HTMLAudioElement;
  mode: PlayerAudioEngineMode;
  debug?: boolean;
}): CdgAudioEngine => {
  const resolvedMedia = media ?? audio;

  if (!resolvedMedia) {
    throw new Error('createAudioEngine requires a media element.');
  }

  if (mode === 'native') {
    return new NativeAudioEngine({ media: resolvedMedia, debug });
  }

  if (mode === 'worklet') {
    return supportsWorkletAudioEngine()
      ? new WorkletAudioEngine({ media: resolvedMedia, debug })
      : new NativeAudioEngine({ media: resolvedMedia, debug });
  }

  return supportsWorkletAudioEngine()
    ? new WorkletAudioEngine({ media: resolvedMedia, debug })
    : new NativeAudioEngine({ media: resolvedMedia, debug });
};
