import { CirclePause, CirclePlay, createElement } from 'lucide';
import {
  MAX_KEY_SEMITONES,
  MIN_KEY_SEMITONES,
} from './utils/controls.constants.js';
import {
  appendClassName,
  applyRangeOrientation,
  clamp,
  createKeyTickOptions,
  createRangeDatalist,
  createVisibleRangeTickLabels,
  deriveViewState,
  formatClock,
  setTempoValue,
} from './utils/controls.functions.js';

/** Placement options for the composed controls panel. */
export type ControlsPanelPosition = 'top' | 'bottom';
/** Orientation options for range-based controls. */
export type ControlsOrientation = 'horizontal' | 'vertical';

/** Playback state contract expected from player adapters. */
export interface ControlsPlayerState {
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';
  trackId: string | null;
  currentTimeMs: number;
  durationMs: number;
  volume: number;
  playbackRate: number;
  pitchSemitones: number;
}

/** Adapter interface used by controls model to communicate with a player implementation. */
export interface ControlsPlayerAdapter extends EventTarget {
  getState(): Readonly<ControlsPlayerState>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(args: { percentage: number }): void;
  setVolume(args: { value: number }): void;
  // Preferred semantic API for singer-facing tempo controls.
  setTempo?(args: { value: number }): void;
  // Backward-compatible alias kept for adapters exposing playback-rate naming.
  setPlaybackRate(args: { value: number }): void;
  setPitchSemitones(args: { value: number }): void;
}

/** View-oriented derived state exposed to controls UIs. */
export interface ControlsViewState extends ControlsPlayerState {
  isPlayable: boolean;
  isPlaying: boolean;
  progressPercent: number;
}

/** Stateful controls model API used by vanilla and framework UIs. */
export interface CdgControlsModel {
  getState(): Readonly<ControlsViewState>;
  subscribe(listener: (state: Readonly<ControlsViewState>) => void): () => void;
  togglePlayPause(): Promise<void>;
  seekPercent(args: { percentage: number }): void;
  setVolume(args: { value: number }): void;
  setTempo(args: { value: number }): void;
  setPitchSemitones(args: { value: number }): void;
  dispose(): void;
}

/** Disposable DOM control part returned by control mount helpers. */
export interface DisposableControl {
  readonly root: HTMLElement;
  dispose(): void;
}

/** Shared mount options for single control builders. */
export interface ControlMountOptions {
  container: HTMLElement;
  model: CdgControlsModel;
  className?: string;
}

/** Mount options for range controls supporting orientation. */
export interface RangeControlMountOptions extends ControlMountOptions {
  orientation?: ControlsOrientation;
}

/** Construction options for the composed CdgControls class. */
export interface CdgControlsOptions {
  container: HTMLElement;
  player: ControlsPlayerAdapter;
  position?: ControlsPanelPosition;
}

class DefaultCdgControlsModel implements CdgControlsModel {
  private readonly player: ControlsPlayerAdapter;
  private readonly listeners = new Set<
    (state: Readonly<ControlsViewState>) => void
  >();
  private state: ControlsViewState;
  private playRequestInFlight = false;
  private pauseAfterPlayRequest = false;

  constructor({ player }: { player: ControlsPlayerAdapter }) {
    this.player = player;
    this.state = deriveViewState({ playerState: this.player.getState() });
    this.player.addEventListener('statechange', this.handleStateChange);
  }

  getState(): Readonly<ControlsViewState> {
    return this.state;
  }

  subscribe(
    listener: (state: Readonly<ControlsViewState>) => void,
  ): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async togglePlayPause(): Promise<void> {
    const liveState = deriveViewState({ playerState: this.player.getState() });

    if (!liveState.isPlayable) {
      return;
    }

    if (this.playRequestInFlight) {
      // While play is still starting, additional toggles flip the desired
      // post-start state (playing <-> paused).
      this.pauseAfterPlayRequest = !this.pauseAfterPlayRequest;
      return;
    }

    if (liveState.isPlaying) {
      this.player.pause();
      return;
    }

    this.playRequestInFlight = true;
    this.pauseAfterPlayRequest = false;

    try {
      await this.player.play();

      if (this.pauseAfterPlayRequest) {
        this.player.pause();
      }
    } finally {
      this.playRequestInFlight = false;
      this.pauseAfterPlayRequest = false;
    }
  }

  seekPercent({ percentage }: { percentage: number }): void {
    this.player.seek({ percentage });
  }

  setVolume({ value }: { value: number }): void {
    this.player.setVolume({ value });
  }

  setTempo({ value }: { value: number }): void {
    setTempoValue({ player: this.player, value });
  }

  setPitchSemitones({ value }: { value: number }): void {
    this.player.setPitchSemitones({ value });
  }

  dispose(): void {
    this.player.removeEventListener('statechange', this.handleStateChange);
    this.listeners.clear();
  }

  private readonly handleStateChange = (): void => {
    this.state = deriveViewState({ playerState: this.player.getState() });
    for (const listener of this.listeners) {
      listener(this.state);
    }
  };
}

/**
 * Creates a controls model bound to a player adapter.
 */
export const createControlsModel = ({
  options,
}: {
  options: { player: ControlsPlayerAdapter };
}): CdgControlsModel => new DefaultCdgControlsModel(options);

/**
 * Mounts a play/pause toggle button.
 */
export const createPlayPauseControl = ({
  container,
  model,
  className,
}: ControlMountOptions): DisposableControl => {
  const root = document.createElement('button');
  root.type = 'button';
  root.dataset['role'] = 'play';
  root.setAttribute('aria-label', 'Play');
  appendClassName({ element: root, className });

  const icon = document.createElement('span');
  icon.dataset['role'] = 'play-icon';
  icon.setAttribute('aria-hidden', 'true');
  root.appendChild(icon);

  const label = document.createElement('span');
  label.dataset['role'] = 'play-text';
  label.className = 'sr-only';
  root.appendChild(label);

  const unsubscribe = model.subscribe((state) => {
    const iconSvg = createElement(state.isPlaying ? CirclePause : CirclePlay, {
      'aria-hidden': 'true',
      class: 'cdg-play-icon',
      focusable: 'false',
      width: 16,
      height: 16,
      'stroke-width': 2.25,
    });

    root.disabled = !state.isPlayable;
    icon.replaceChildren(iconSvg);
    label.textContent = state.isPlaying ? 'Pause' : 'Play';
    root.setAttribute('aria-label', state.isPlaying ? 'Pause' : 'Play');
  });

  const handleClick = (): void => {
    void model.togglePlayPause();
  };

  root.addEventListener('click', handleClick);
  container.appendChild(root);

  return {
    root,
    dispose(): void {
      root.removeEventListener('click', handleClick);
      unsubscribe();
      root.remove();
    },
  };
};

/**
 * Mounts current playback time display.
 */
export const createCurrentTimeDisplay = ({
  container,
  model,
  className,
}: ControlMountOptions): DisposableControl => {
  const root = document.createElement('span');
  root.dataset['role'] = 'current-time';
  appendClassName({ element: root, className });

  const unsubscribe = model.subscribe((state) => {
    root.textContent = formatClock({ ms: state.currentTimeMs });
  });

  container.appendChild(root);

  return {
    root,
    dispose(): void {
      unsubscribe();
      root.remove();
    },
  };
};

/**
 * Mounts total duration display.
 */
export const createDurationDisplay = ({
  container,
  model,
  className,
}: ControlMountOptions): DisposableControl => {
  const root = document.createElement('span');
  root.dataset['role'] = 'duration';
  appendClassName({ element: root, className });

  const unsubscribe = model.subscribe((state) => {
    root.textContent = formatClock({ ms: state.durationMs });
  });

  container.appendChild(root);

  return {
    root,
    dispose(): void {
      unsubscribe();
      root.remove();
    },
  };
};

/**
 * Mounts seek slider control bound to playback progress.
 */
export const createProgressControl = ({
  container,
  model,
  className,
}: ControlMountOptions): DisposableControl => {
  const root = document.createElement('input');
  root.type = 'range';
  root.min = '0';
  root.max = '100';
  root.step = '0.1';
  root.value = '0';
  root.dataset['role'] = 'progress';
  appendClassName({ element: root, className });

  const unsubscribe = model.subscribe((state) => {
    root.disabled = !state.isPlayable;
    root.value = state.progressPercent.toFixed(1);
    root.style.setProperty(
      '--progress-percent',
      `${state.progressPercent.toFixed(1)}%`,
    );
  });

  const handleInput = (): void => {
    model.seekPercent({ percentage: Number(root.value) });
  };

  root.addEventListener('input', handleInput);
  container.appendChild(root);

  return {
    root,
    dispose(): void {
      root.removeEventListener('input', handleInput);
      unsubscribe();
      root.remove();
    },
  };
};

/**
 * Mounts volume slider control.
 */
export const createVolumeControl = ({
  container,
  model,
  className,
  orientation = 'horizontal',
}: RangeControlMountOptions): DisposableControl => {
  const root = document.createElement('label');
  root.className = 'control-group control-group--volume';
  appendClassName({ element: root, className });

  const labelText = document.createElement('span');
  labelText.dataset['role'] = 'control-label';
  labelText.textContent = 'Volume';
  root.appendChild(labelText);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.value = '1';
  input.dataset['role'] = 'volume';
  applyRangeOrientation({ root, input, orientation });
  const datalist = createRangeDatalist({
    input,
    options: [
      { value: 0 },
      { value: 0.1 },
      { value: 0.2 },
      { value: 0.3 },
      { value: 0.4 },
      { value: 0.5 },
      { value: 0.6 },
      { value: 0.7 },
      { value: 0.8 },
      { value: 0.9 },
      { value: 1 },
    ],
  });
  root.appendChild(input);
  root.appendChild(datalist);

  const unsubscribe = model.subscribe((state) => {
    input.disabled = !state.isPlayable;
    input.value = state.volume.toFixed(2);
  });

  const handleInput = (): void => {
    model.setVolume({ value: Number(input.value) });
  };

  input.addEventListener('input', handleInput);
  container.appendChild(root);

  return {
    root,
    dispose(): void {
      input.removeEventListener('input', handleInput);
      unsubscribe();
      root.remove();
    },
  };
};

/**
 * Mounts tempo slider control.
 */
export const createTempoControl = ({
  container,
  model,
  className,
  orientation = 'horizontal',
}: RangeControlMountOptions): DisposableControl => {
  const root = document.createElement('label');
  root.className = 'control-group control-group--tempo';
  appendClassName({ element: root, className });

  const labelText = document.createElement('span');
  labelText.dataset['role'] = 'control-label';
  labelText.textContent = 'Tempo';
  root.appendChild(labelText);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0.5';
  input.max = '2';
  input.step = '0.01';
  input.value = '1';
  input.dataset['role'] = 'playback-rate';
  applyRangeOrientation({ root, input, orientation });
  const datalist = createRangeDatalist({
    input,
    options: [
      { value: 0.5 },
      { value: 0.75 },
      { value: 1 },
      { value: 1.25 },
      { value: 1.5 },
      { value: 1.75 },
      { value: 2 },
    ],
  });
  root.appendChild(input);
  root.appendChild(datalist);

  const unsubscribe = model.subscribe((state) => {
    input.disabled = !state.isPlayable;
    input.value = state.playbackRate.toFixed(2);
  });

  const handleInput = (): void => {
    model.setTempo({ value: Number(input.value) });
  };

  input.addEventListener('input', handleInput);
  container.appendChild(root);

  return {
    root,
    dispose(): void {
      input.removeEventListener('input', handleInput);
      unsubscribe();
      root.remove();
    },
  };
};

/**
 * Mounts key-shift slider control.
 */
export const createKeyControl = ({
  container,
  model,
  className,
  orientation = 'vertical',
}: RangeControlMountOptions): DisposableControl => {
  const root = document.createElement('label');
  root.className = 'control-group control-group--key';
  appendClassName({ element: root, className });

  const labelText = document.createElement('span');
  labelText.dataset['role'] = 'control-label';
  labelText.textContent = 'Key';
  root.appendChild(labelText);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = MIN_KEY_SEMITONES.toString();
  input.max = MAX_KEY_SEMITONES.toString();
  input.step = '1';
  input.value = '0';
  input.dataset['role'] = 'pitch-semitones';
  input.setAttribute('aria-label', 'Key shift in semitones');
  applyRangeOrientation({ root, input, orientation });

  const keyTickOptions = createKeyTickOptions();

  const datalist = createRangeDatalist({
    input,
    options: keyTickOptions,
  });

  const tickLabels = createVisibleRangeTickLabels({ options: keyTickOptions });

  root.appendChild(input);
  root.appendChild(tickLabels);
  root.appendChild(datalist);

  const unsubscribe = model.subscribe((state) => {
    input.disabled = !state.isPlayable;
    input.value = Math.round(
      clamp({
        value: state.pitchSemitones,
        min: MIN_KEY_SEMITONES,
        max: MAX_KEY_SEMITONES,
      }),
    ).toString();
  });

  const handleInput = (): void => {
    model.setPitchSemitones({ value: Number.parseInt(input.value, 10) });
  };

  input.addEventListener('input', handleInput);
  container.appendChild(root);

  return {
    root,
    dispose(): void {
      input.removeEventListener('input', handleInput);
      unsubscribe();
      root.remove();
    },
  };
};

/**
 * Composed controls panel that mounts all standard controls as one unit.
 */
export class CdgControls {
  readonly root: HTMLElement;

  private readonly model: CdgControlsModel;
  private readonly parts: DisposableControl[];

  constructor({ container, player, position = 'bottom' }: CdgControlsOptions) {
    this.root = document.createElement('section');
    this.root.className = `cxing-controls cxing-controls--${position}`;
    this.model = createControlsModel({ options: { player } });
    this.parts = [
      createPlayPauseControl({ container: this.root, model: this.model }),
      createCurrentTimeDisplay({ container: this.root, model: this.model }),
      createProgressControl({ container: this.root, model: this.model }),
      createDurationDisplay({ container: this.root, model: this.model }),
      createVolumeControl({ container: this.root, model: this.model }),
      createTempoControl({ container: this.root, model: this.model }),
      createKeyControl({ container: this.root, model: this.model }),
    ];
    container.appendChild(this.root);
  }

  dispose(): void {
    for (const part of this.parts) {
      part.dispose();
    }
    this.model.dispose();
    this.root.remove();
  }
}

/**
 * Creates and mounts a composed controls panel.
 */
export const createControls = ({
  options,
}: {
  options: CdgControlsOptions;
}): CdgControls => new CdgControls(options);
