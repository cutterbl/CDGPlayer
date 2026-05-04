import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for framework-agnostic AppElement behavior and wiring.
 */

const {
  createPlayerMock,
  createControlsModelMock,
  createPlayPauseControlMock,
  createCurrentTimeDisplayMock,
  createProgressControlMock,
  createDurationDisplayMock,
  createVolumeControlMock,
  createTempoControlMock,
  createKeyControlMock,
} = vi.hoisted(() => ({
  createPlayerMock: vi.fn(),
  createControlsModelMock: vi.fn(),
  createPlayPauseControlMock: vi.fn(),
  createCurrentTimeDisplayMock: vi.fn(),
  createProgressControlMock: vi.fn(),
  createDurationDisplayMock: vi.fn(),
  createVolumeControlMock: vi.fn(),
  createTempoControlMock: vi.fn(),
  createKeyControlMock: vi.fn(),
}));

vi.mock('@cxing/media-player', () => ({
  createPlayer: createPlayerMock,
}));

vi.mock('@cxing/media-playback-controls', () => ({
  createControlsModel: createControlsModelMock,
  createPlayPauseControl: createPlayPauseControlMock,
  createCurrentTimeDisplay: createCurrentTimeDisplayMock,
  createProgressControl: createProgressControlMock,
  createDurationDisplay: createDurationDisplayMock,
  createVolumeControl: createVolumeControlMock,
  createTempoControl: createTempoControlMock,
  createKeyControl: createKeyControlMock,
}));

import { AppElement } from './app.element';

const registerAppElement = (): void => {
  if (!customElements.get('cdgplayer-demo-app')) {
    customElements.define('cdgplayer-demo-app', AppElement);
  }
};

const createDemoHarness = ({
  playerState = { status: 'idle' },
  loadResult,
  loadError,
  initialViewState = { status: 'idle' },
}: {
  playerState?: { status: string };
  loadResult?:
    | {
        metadata?: {
          title: string;
          artist: string;
        };
        mediaKind?: 'audio' | 'video';
        hasGraphics?: boolean;
      }
    | undefined;
  loadError?: Error;
  initialViewState?: { status: string };
} = {}) => {
  type ControlsState = { status: string };
  type ControlsStateListener = (state: ControlsState) => void;

  const unsubscribeMock = vi.fn();
  const playerListeners = new Map<string, EventListener>();
  let controlsStateListener: ControlsStateListener | undefined;

  const player = {
    addEventListener: vi.fn((eventName: string, listener: EventListener) => {
      playerListeners.set(eventName, listener);
    }),
    getState: vi.fn(() => playerState),
    load: loadError
      ? vi.fn(async () => {
          throw loadError;
        })
      : vi.fn(async () => loadResult),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  const model = {
    subscribe: vi.fn((listener: ControlsStateListener) => {
      controlsStateListener = listener;
      listener(initialViewState);
      return unsubscribeMock;
    }),
    togglePlayPause: vi.fn(async () => undefined),
    dispose: vi.fn(),
  };
  const controlDisposers = Array.from({ length: 7 }, () => ({
    dispose: vi.fn(),
  }));

  createPlayerMock.mockReturnValue(player);
  createControlsModelMock.mockReturnValue(model);
  createPlayPauseControlMock.mockReturnValue(controlDisposers[0]);
  createCurrentTimeDisplayMock.mockReturnValue(controlDisposers[1]);
  createProgressControlMock.mockReturnValue(controlDisposers[2]);
  createDurationDisplayMock.mockReturnValue(controlDisposers[3]);
  createVolumeControlMock.mockReturnValue(controlDisposers[4]);
  createTempoControlMock.mockReturnValue(controlDisposers[5]);
  createKeyControlMock.mockReturnValue(controlDisposers[6]);

  return {
    player,
    model,
    controlDisposers,
    unsubscribeMock,
    emitControlsState(nextState: ControlsState) {
      controlsStateListener?.(nextState);
    },
    emitPlayerEvent(eventName: string, event: Event) {
      playerListeners.get(eventName)?.(event);
    },
  };
};

describe('AppElement', () => {
  beforeEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    createPlayerMock.mockReset();
    createControlsModelMock.mockReset();
    createPlayPauseControlMock.mockReset();
    createCurrentTimeDisplayMock.mockReset();
    createProgressControlMock.mockReset();
    createDurationDisplayMock.mockReset();
    createVolumeControlMock.mockReset();
    createTempoControlMock.mockReset();
    createKeyControlMock.mockReset();
  });

  /**
   * Verifies base rendering and control/model wiring lifecycle.
   */
  it('renders the demo shell and wires player + controls', () => {
    const unsubscribeMock = vi.fn();
    const player = {
      addEventListener: vi.fn(),
      getState: vi.fn(() => ({ status: 'idle' })),
      load: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    const model = {
      subscribe: vi.fn(() => unsubscribeMock),
      togglePlayPause: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    const controlDisposers = [
      { dispose: vi.fn() },
      { dispose: vi.fn() },
      { dispose: vi.fn() },
      { dispose: vi.fn() },
      { dispose: vi.fn() },
      { dispose: vi.fn() },
      { dispose: vi.fn() },
    ];

    createPlayerMock.mockReturnValue(player);
    createControlsModelMock.mockReturnValue(model);
    createPlayPauseControlMock.mockReturnValue(controlDisposers[0]);
    createCurrentTimeDisplayMock.mockReturnValue(controlDisposers[1]);
    createProgressControlMock.mockReturnValue(controlDisposers[2]);
    createDurationDisplayMock.mockReturnValue(controlDisposers[3]);
    createVolumeControlMock.mockReturnValue(controlDisposers[4]);
    createTempoControlMock.mockReturnValue(controlDisposers[5]);
    createKeyControlMock.mockReturnValue(controlDisposers[6]);

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    expect(app.querySelector('#track-input')).not.toBeNull();
    expect(app.querySelector('[data-role="title-image"]')).not.toBeNull();
    expect(createPlayerMock).toHaveBeenCalledOnce();
    expect(createControlsModelMock).toHaveBeenCalledOnce();
    expect(createControlsModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          player,
        }),
      }),
    );

    expect(createPlayPauseControlMock).toHaveBeenCalledOnce();
    expect(createCurrentTimeDisplayMock).toHaveBeenCalledOnce();
    expect(createProgressControlMock).toHaveBeenCalledOnce();
    expect(createDurationDisplayMock).toHaveBeenCalledOnce();
    expect(createVolumeControlMock).toHaveBeenCalledOnce();
    expect(createTempoControlMock).toHaveBeenCalledOnce();
    expect(createKeyControlMock).toHaveBeenCalledOnce();

    document.body.removeChild(app);
    expect(unsubscribeMock).toHaveBeenCalledOnce();
    for (const control of controlDisposers) {
      expect(control.dispose).toHaveBeenCalledOnce();
    }
    expect(model.dispose).toHaveBeenCalledOnce();
    expect(player.dispose).toHaveBeenCalledOnce();
  });

  /**
   * Verifies selecting a new file stops current playback before load.
   */
  it('stops the current track before loading a newly selected file', async () => {
    const unsubscribeMock = vi.fn();
    const player = {
      addEventListener: vi.fn(),
      getState: vi.fn(() => ({ status: 'ready' })),
      load: vi.fn(async () => undefined),
      stop: vi.fn(),
      dispose: vi.fn(),
    };
    const model = {
      subscribe: vi.fn(() => unsubscribeMock),
      togglePlayPause: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    const controlDisposers = Array.from({ length: 7 }, () => ({
      dispose: vi.fn(),
    }));

    createPlayerMock.mockReturnValue(player);
    createControlsModelMock.mockReturnValue(model);
    createPlayPauseControlMock.mockReturnValue(controlDisposers[0]);
    createCurrentTimeDisplayMock.mockReturnValue(controlDisposers[1]);
    createProgressControlMock.mockReturnValue(controlDisposers[2]);
    createDurationDisplayMock.mockReturnValue(controlDisposers[3]);
    createVolumeControlMock.mockReturnValue(controlDisposers[4]);
    createTempoControlMock.mockReturnValue(controlDisposers[5]);
    createKeyControlMock.mockReturnValue(controlDisposers[6]);

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const input = app.querySelector<HTMLInputElement>('#track-input');
    const file = new File(['zip-content'], 'replacement.zip', {
      type: 'application/zip',
    });

    if (!input) {
      throw new Error('Expected file input to exist.');
    }

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
        0: file,
      },
    });

    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();

    expect(player.stop).toHaveBeenCalledOnce();
    expect(player.load).toHaveBeenCalledWith({
      input: { kind: 'file', file },
    });
    expect(input.value).toBe('');

    document.body.removeChild(app);
  });

  /**
   * Verifies status overlay visibility and fade timing behavior.
   */
  it('shows status messages over the stage and fades them after 3 seconds', async () => {
    vi.useFakeTimers();

    const unsubscribeMock = vi.fn();
    const playerStateChangeListener = vi.fn();
    const player = {
      addEventListener: vi.fn((eventName: string, listener: EventListener) => {
        if (eventName === 'statechange') {
          playerStateChangeListener.mockImplementation(listener);
        }
      }),
      getState: vi.fn(() => ({ status: 'idle' })),
      load: vi.fn(async () => undefined),
      stop: vi.fn(),
      dispose: vi.fn(),
    };
    const model = {
      subscribe: vi.fn((listener: (state: { status: string }) => void) => {
        listener({ status: 'idle' });
        return unsubscribeMock;
      }),
      togglePlayPause: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    const controlDisposers = Array.from({ length: 7 }, () => ({
      dispose: vi.fn(),
    }));

    createPlayerMock.mockReturnValue(player);
    createControlsModelMock.mockReturnValue(model);
    createPlayPauseControlMock.mockReturnValue(controlDisposers[0]);
    createCurrentTimeDisplayMock.mockReturnValue(controlDisposers[1]);
    createProgressControlMock.mockReturnValue(controlDisposers[2]);
    createDurationDisplayMock.mockReturnValue(controlDisposers[3]);
    createVolumeControlMock.mockReturnValue(controlDisposers[4]);
    createTempoControlMock.mockReturnValue(controlDisposers[5]);
    createKeyControlMock.mockReturnValue(controlDisposers[6]);

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const status = app.querySelector<HTMLElement>('[data-role="status"]');

    expect(status?.classList.contains('is-visible')).toBe(true);
    expect(status?.textContent).toBe('Choose a track to start.');

    vi.advanceTimersByTime(2999);
    expect(status?.classList.contains('is-visible')).toBe(true);

    const input = app.querySelector<HTMLInputElement>('#track-input');
    const file = new File(['zip-content'], 'replacement.zip', {
      type: 'application/zip',
    });

    if (!input) {
      throw new Error('Expected file input to exist.');
    }

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
        0: file,
      },
    });

    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();

    expect(status?.textContent).toBe('Track loaded.');
    expect(status?.classList.contains('is-visible')).toBe(true);

    vi.advanceTimersByTime(2999);
    expect(status?.classList.contains('is-visible')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(status?.classList.contains('is-visible')).toBe(false);

    document.body.removeChild(app);
  });

  it('toggles play/pause when clicking stage but ignores settings-panel clicks', () => {
    const unsubscribeMock = vi.fn();
    const player = {
      addEventListener: vi.fn(),
      getState: vi.fn(() => ({ status: 'ready' })),
      load: vi.fn(async () => undefined),
      stop: vi.fn(),
      dispose: vi.fn(),
    };
    const model = {
      subscribe: vi.fn(() => unsubscribeMock),
      togglePlayPause: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    const controlDisposers = Array.from({ length: 7 }, () => ({
      dispose: vi.fn(),
    }));

    createPlayerMock.mockReturnValue(player);
    createControlsModelMock.mockReturnValue(model);
    createPlayPauseControlMock.mockReturnValue(controlDisposers[0]);
    createCurrentTimeDisplayMock.mockReturnValue(controlDisposers[1]);
    createProgressControlMock.mockReturnValue(controlDisposers[2]);
    createDurationDisplayMock.mockReturnValue(controlDisposers[3]);
    createVolumeControlMock.mockReturnValue(controlDisposers[4]);
    createTempoControlMock.mockReturnValue(controlDisposers[5]);
    createKeyControlMock.mockReturnValue(controlDisposers[6]);

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const stage = app.querySelector<HTMLElement>('[data-role="stage"]');
    const settingsPanel = app.querySelector<HTMLElement>(
      '[data-role="settings-panel"]',
    );

    if (!stage || !settingsPanel) {
      throw new Error('Expected stage and settings panel to exist.');
    }

    stage.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(model.togglePlayPause).toHaveBeenCalledTimes(1);

    settingsPanel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(model.togglePlayPause).toHaveBeenCalledTimes(1);

    document.body.removeChild(app);
  });

  it('shows load failure state when player.load rejects', async () => {
    const harness = createDemoHarness({
      loadError: new Error('Broken zip'),
      playerState: { status: 'error' },
    });

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const input = app.querySelector<HTMLInputElement>('#track-input');
    const status = app.querySelector<HTMLElement>('[data-role="status"]');
    const shell = app.querySelector<HTMLElement>('[data-role="app-shell"]');
    const file = new File(['zip-content'], 'broken.zip', {
      type: 'application/zip',
    });

    if (!input) {
      throw new Error('Expected file input to exist.');
    }

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
        0: file,
      },
    });

    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.player.stop).toHaveBeenCalledOnce();
    expect(status?.textContent).toBe('Load failed: Broken zip');
    expect(shell?.classList.contains('show-player')).toBe(true);
    expect(shell?.classList.contains('has-track')).toBe(false);
    expect(input.value).toBe('');

    document.body.removeChild(app);
  });

  it('renders fallback metadata and syncs ready/playing layout classes', async () => {
    const harness = createDemoHarness({
      loadResult: {
        metadata: {
          title: '   ',
          artist: '   ',
        },
      },
      playerState: { status: 'playing' },
    });

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const input = app.querySelector<HTMLInputElement>('#track-input');
    const title = app.querySelector<HTMLElement>(
      '[data-role="title-meta-title"]',
    );
    const artist = app.querySelector<HTMLElement>(
      '[data-role="title-meta-artist"]',
    );
    const titleImage = app.querySelector<HTMLElement>(
      '[data-role="title-image"]',
    );
    const shell = app.querySelector<HTMLElement>('[data-role="app-shell"]');
    const file = new File(['zip-content'], 'ready.zip', {
      type: 'application/zip',
    });

    if (!input) {
      throw new Error('Expected file input to exist.');
    }

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
        0: file,
      },
    });

    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();

    expect(title?.textContent).toBe('Unknown Title');
    expect(artist?.textContent).toBe('Unknown Artist');
    expect(titleImage?.classList.contains('show-metadata')).toBe(true);

    harness.emitControlsState({ status: 'ready' });
    expect(shell?.classList.contains('has-track')).toBe(true);
    expect(shell?.classList.contains('is-playing')).toBe(false);

    harness.emitControlsState({ status: 'playing' });
    expect(shell?.classList.contains('is-playing')).toBe(true);
    expect(titleImage?.classList.contains('hide')).toBe(true);

    document.body.removeChild(app);
  });

  it('captures perf metrics and exports a local speed report', () => {
    const harness = createDemoHarness();
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:perf-report');
    const revokeObjectUrlSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const perfHud = app.querySelector<HTMLElement>('[data-role="perf-hud"]');
    const exportButton = app.querySelector<HTMLButtonElement>(
      '[data-role="perf-export"]',
    );

    expect(perfHud?.textContent).toContain('play a song to collect samples');
    expect(exportButton?.disabled).toBe(true);

    harness.emitPlayerEvent(
      'rendermetrics',
      new CustomEvent('rendermetrics', {
        detail: {
          mode: 'worker',
          frameCpuMs: 4.25,
          transferredBytes: 1024,
          atMs: 33,
        },
      }),
    );

    expect(perfHud?.textContent).toContain('Speed check (worker)');
    expect(perfHud?.textContent).toContain('avg 4.25 ms');
    expect(exportButton?.disabled).toBe(false);

    exportButton?.click();

    expect(createObjectUrlSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectUrlSpy).toHaveBeenCalledOnce();
    expect(
      (globalThis as { __CDG_PERF_ARTIFACT__?: { source: string } })
        .__CDG_PERF_ARTIFACT__?.source,
    ).toBe('apps/demo');

    document.body.removeChild(app);
  });

  it('handles player statechange callbacks when state is missing and when playback starts', () => {
    const harness = createDemoHarness({
      playerState: { status: 'idle' },
    });

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    harness.player.getState.mockReturnValueOnce(undefined as never);
    harness.emitPlayerEvent('statechange', new Event('statechange'));

    harness.player.getState.mockReturnValueOnce({ status: 'paused' });
    harness.emitPlayerEvent('statechange', new Event('statechange'));

    harness.player.getState.mockReturnValueOnce({ status: 'playing' });
    harness.emitPlayerEvent('statechange', new Event('statechange'));

    harness.emitControlsState({ status: 'ready' });

    const titleImage = app.querySelector<HTMLElement>(
      '[data-role="title-image"]',
    );
    expect(titleImage?.classList.contains('hide')).toBe(true);

    document.body.removeChild(app);
  });

  it('shows user-facing fallback messages for non-Error failures', async () => {
    const harness = createDemoHarness({
      loadError: 'zip blew up' as never,
      playerState: { status: 'error' },
    });

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const input = app.querySelector<HTMLInputElement>('#track-input');
    const status = app.querySelector<HTMLElement>('[data-role="status"]');
    const file = new File(['zip-content'], 'broken.zip', {
      type: 'application/zip',
    });

    if (!input) {
      throw new Error('Expected file input to exist.');
    }

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
        0: file,
      },
    });

    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.player.stop).toHaveBeenCalledOnce();
    expect(status?.textContent).toBe('Load failed: Unknown load error');

    document.body.removeChild(app);
  });

  it('stops playback when visibility changes to hidden', () => {
    const harness = createDemoHarness({
      playerState: { status: 'playing' },
    });

    const visibilityDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState',
    );

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(harness.player.stop).toHaveBeenCalled();

    document.body.removeChild(app);

    if (visibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    } else {
      Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('stops playback when receiving stop-playback window message', () => {
    const harness = createDemoHarness({
      playerState: { status: 'playing' },
    });

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'cdg:stop-playback' },
      }),
    );

    expect(harness.player.stop).toHaveBeenCalled();

    document.body.removeChild(app);
  });

  it('shows codec diagnostics for unsupported video paths', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');

    const harness = createDemoHarness({
      loadError: new Error('Unable to load video media in this browser'),
      playerState: { status: 'error' },
    });

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const input = app.querySelector<HTMLInputElement>('#track-input');
    const codecDiagnostic = app.querySelector<HTMLElement>(
      '[data-role="codec-diagnostic"]',
    );
    const file = new File(['video-content'], 'unsupported.mp4', {
      type: 'video/mp4',
    });

    if (!input) {
      throw new Error('Expected file input to exist.');
    }

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
        0: file,
      },
    });

    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();

    expect(codecDiagnostic?.textContent).toContain(
      'unsupported video codec for this browser',
    );
    expect(codecDiagnostic?.classList.contains('is-visible')).toBe(true);
    expect(harness.player.stop).toHaveBeenCalledOnce();

    document.body.removeChild(app);
  });

  it('surfaces non-Error initialization failures when player setup throws', () => {
    createPlayerMock.mockImplementation(() => {
      throw 'setup exploded';
    });
    createControlsModelMock.mockReset();

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const status = app.querySelector<HTMLElement>('[data-role="status"]');
    expect(status?.textContent).toBe(
      'Demo unavailable: Unknown initialization error',
    );

    document.body.removeChild(app);
  });

  it('shows a user-facing initialization error when player setup throws', () => {
    createPlayerMock.mockImplementation(() => {
      throw new Error('Canvas init failed');
    });
    createControlsModelMock.mockImplementation(() => {
      throw new Error('Should not create controls after player failure');
    });

    registerAppElement();

    const app = document.createElement('cdgplayer-demo-app') as AppElement;
    document.body.appendChild(app);

    const status = app.querySelector<HTMLElement>('[data-role="status"]');

    expect(status?.textContent).toBe('Demo unavailable: Canvas init failed');
    expect(createControlsModelMock).not.toHaveBeenCalled();

    document.body.removeChild(app);
  });
});
