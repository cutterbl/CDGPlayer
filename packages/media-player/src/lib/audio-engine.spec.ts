import { createAudioEngine } from './audio-engine.js';

const soundTouchMocks = vi.hoisted(() => {
  class MockSoundTouchNode {
    static register = vi.fn(async () => undefined);

    playbackRate = { setValueAtTime: vi.fn() };
    pitch = { setValueAtTime: vi.fn() };
    pitchSemitones = { setValueAtTime: vi.fn() };

    connect = vi.fn();
    disconnect = vi.fn();

    constructor(context: BaseAudioContext) {
      void context;
    }
  }

  return { MockSoundTouchNode };
});

vi.mock('@soundtouchjs/audio-worklet', () => ({
  SoundTouchNode: soundTouchMocks.MockSoundTouchNode,
}));

describe('audio-engine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses native mode when explicitly requested', async () => {
    const audio = document.createElement('audio');
    const playSpy = vi
      .spyOn(audio, 'play')
      .mockResolvedValue(undefined as unknown as void);
    const pauseSpy = vi
      .spyOn(audio, 'pause')
      .mockImplementation(() => undefined);

    const engine = createAudioEngine({ audio, mode: 'native' });

    expect(engine.mode).toBe('native');

    await engine.play();
    engine.pause();
    engine.stop();
    engine.setVolume({ value: 0.4 });
    engine.setTempo({ value: 1.15 });
    engine.setPlaybackRate({ value: 0.9 });
    engine.setPitchSemitones({ value: 7 });
    engine.dispose();

    expect(playSpy).toHaveBeenCalledOnce();
    expect(pauseSpy).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
    expect(audio.volume).toBe(0.4);
    expect(audio.playbackRate).toBe(0.9);
  });

  it('falls back to native when worklet mode is requested but unsupported', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('AudioWorkletNode', undefined);

    const audio = document.createElement('audio');
    const engine = createAudioEngine({ audio, mode: 'worklet' });

    expect(engine.mode).toBe('native');
  });

  it('uses worklet mode in auto when APIs exist and handles init fallback safely', async () => {
    class MockAudioContext {
      state: AudioContextState = 'suspended';
      currentTime = 12;
      audioWorklet = undefined;
      destination = {} as AudioNode;

      createMediaElementSource = vi.fn(
        () =>
          ({
            connect: vi.fn(),
            disconnect: vi.fn(),
          }) as unknown as MediaElementAudioSourceNode,
      );

      createGain = vi.fn(
        () =>
          ({
            gain: { value: 0 },
            connect: vi.fn(),
            disconnect: vi.fn(),
          }) as unknown as GainNode,
      );

      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
    }

    vi.stubGlobal(
      'AudioContext',
      MockAudioContext as unknown as typeof AudioContext,
    );
    vi.stubGlobal(
      'AudioWorkletNode',
      class MockAudioWorkletNode {} as unknown as typeof AudioWorkletNode,
    );

    const audio = document.createElement('audio');
    const playSpy = vi
      .spyOn(audio, 'play')
      .mockResolvedValue(undefined as unknown as void);
    vi.spyOn(audio, 'pause').mockImplementation(() => undefined);

    const engine = createAudioEngine({ audio, mode: 'auto' });

    expect(engine.mode).toBe('worklet');

    await engine.play();
    engine.pause();
    engine.stop();

    expect(playSpy).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(0);
  });

  it('updates node params and disconnects graph resources when present', () => {
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {} as unknown as typeof AudioContext,
    );
    vi.stubGlobal(
      'AudioWorkletNode',
      class MockAudioWorkletNode {} as unknown as typeof AudioWorkletNode,
    );

    const audio = document.createElement('audio');
    const engine = createAudioEngine({ audio, mode: 'worklet' }) as unknown as {
      setVolume: ({ value }: { value: number }) => void;
      setTempo: ({ value }: { value: number }) => void;
      setPitchSemitones: ({ value }: { value: number }) => void;
      setPlaybackRate: ({ value }: { value: number }) => void;
      dispose: () => void;
      gainNode: {
        gain: { value: number };
        disconnect: ReturnType<typeof vi.fn>;
      } | null;
      sourceNode: { disconnect: ReturnType<typeof vi.fn> } | null;
      workletNode: {
        playbackRate: { setValueAtTime: ReturnType<typeof vi.fn> };
        pitchSemitones: { setValueAtTime: ReturnType<typeof vi.fn> };
        disconnect: ReturnType<typeof vi.fn>;
      } | null;
      context: { currentTime: number; close: ReturnType<typeof vi.fn> } | null;
    };

    const playbackRateSet = vi.fn();
    const pitchSemitonesSet = vi.fn();

    engine.context = { currentTime: 9, close: vi.fn(async () => undefined) };
    engine.sourceNode = { disconnect: vi.fn() };
    engine.gainNode = {
      gain: { value: 0 },
      disconnect: vi.fn(),
    };
    engine.workletNode = {
      playbackRate: { setValueAtTime: playbackRateSet },
      pitchSemitones: { setValueAtTime: pitchSemitonesSet },
      disconnect: vi.fn(),
    };

    engine.setVolume({ value: 0.25 });
    engine.setTempo({ value: 1.5 });
    engine.setPlaybackRate({ value: 0.8 });
    engine.setPitchSemitones({ value: -4 });

    expect(engine.gainNode?.gain.value).toBe(0.25);
    expect(playbackRateSet).toHaveBeenCalledWith(1.5, 9);
    expect(playbackRateSet).toHaveBeenCalledWith(0.8, 9);
    expect(pitchSemitonesSet).toHaveBeenCalledWith(-4, 9);

    engine.dispose();

    expect(engine.workletNode).toBeNull();
    expect(engine.gainNode).toBeNull();
    expect(engine.sourceNode).toBeNull();
    expect(engine.context).toBeNull();
  });

  it('initializes full worklet graph and applies pitch-preserve overrides', async () => {
    const sourceConnect = vi.fn();
    const sourceDisconnect = vi.fn();
    const gainConnect = vi.fn();
    const gainDisconnect = vi.fn();
    const resume = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);

    class MockAudioContext {
      state: AudioContextState = 'suspended';
      currentTime = 7;
      audioWorklet = {};
      destination = {} as AudioNode;

      createMediaElementSource = vi.fn(
        () =>
          ({
            connect: sourceConnect,
            disconnect: sourceDisconnect,
          }) as unknown as MediaElementAudioSourceNode,
      );

      createGain = vi.fn(
        () =>
          ({
            gain: { value: 0 },
            connect: gainConnect,
            disconnect: gainDisconnect,
          }) as unknown as GainNode,
      );

      resume = resume;
      close = close;
    }

    vi.stubGlobal(
      'AudioContext',
      MockAudioContext as unknown as typeof AudioContext,
    );
    vi.stubGlobal(
      'AudioWorkletNode',
      class MockAudioWorkletNode {} as unknown as typeof AudioWorkletNode,
    );

    const audio = document.createElement('audio') as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };

    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.webkitPreservesPitch = true;

    const playSpy = vi
      .spyOn(audio, 'play')
      .mockResolvedValue(undefined as unknown as void);

    const engine = createAudioEngine({ audio, mode: 'worklet' }) as unknown as {
      play: () => Promise<void>;
      context: MockAudioContext | null;
      dispose: () => void;
    };

    await engine.play();

    expect(soundTouchMocks.MockSoundTouchNode.register).toHaveBeenCalledOnce();
    expect(sourceConnect).toHaveBeenCalled();
    expect(gainConnect).toHaveBeenCalled();
    expect(resume).toHaveBeenCalledOnce();
    expect(playSpy).toHaveBeenCalledOnce();
    expect(audio.preservesPitch).toBe(false);
    expect(audio.mozPreservesPitch).toBe(false);
    expect(audio.webkitPreservesPitch).toBe(false);

    engine.dispose();
    expect(sourceDisconnect).toHaveBeenCalled();
    expect(gainDisconnect).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('uses no-op branches when gain/worklet/context are absent', () => {
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {} as unknown as typeof AudioContext,
    );
    vi.stubGlobal(
      'AudioWorkletNode',
      class MockAudioWorkletNode {} as unknown as typeof AudioWorkletNode,
    );

    const audio = document.createElement('audio');
    const engine = createAudioEngine({ audio, mode: 'worklet' }) as unknown as {
      setVolume: ({ value }: { value: number }) => void;
      setTempo: ({ value }: { value: number }) => void;
      setPitchSemitones: ({ value }: { value: number }) => void;
      dispose: () => void;
    };

    engine.setVolume({ value: 0.6 });
    engine.setTempo({ value: 1.1 });
    engine.setPitchSemitones({ value: 2 });
    engine.dispose();

    expect(audio.volume).toBe(0.6);
    expect(audio.playbackRate).toBe(1.1);
  });

  it('awaits in-flight initialization promise path', async () => {
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {} as unknown as typeof AudioContext,
    );
    vi.stubGlobal(
      'AudioWorkletNode',
      class MockAudioWorkletNode {} as unknown as typeof AudioWorkletNode,
    );

    const audio = document.createElement('audio');
    const playSpy = vi
      .spyOn(audio, 'play')
      .mockResolvedValue(undefined as unknown as void);

    const engine = createAudioEngine({ audio, mode: 'worklet' }) as unknown as {
      play: () => Promise<void>;
      initPromise: Promise<void> | null;
      context: { state: AudioContextState; resume: () => Promise<void> } | null;
    };

    engine.context = null;
    engine.initPromise = Promise.resolve();

    await engine.play();

    expect(playSpy).toHaveBeenCalledOnce();
    expect(engine.initPromise).not.toBeNull();
  });
});
