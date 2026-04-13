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

vi.mock('@cxing/cdg-player', () => ({
  createPlayer: createPlayerMock,
}));

vi.mock('@cxing/cdg-controls', () => ({
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

    if (!customElements.get('cdgplayer-demo-app')) {
      customElements.define('cdgplayer-demo-app', AppElement);
    }

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

    if (!customElements.get('cdgplayer-demo-app')) {
      customElements.define('cdgplayer-demo-app', AppElement);
    }

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

    if (!customElements.get('cdgplayer-demo-app')) {
      customElements.define('cdgplayer-demo-app', AppElement);
    }

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

    if (!customElements.get('cdgplayer-demo-app')) {
      customElements.define('cdgplayer-demo-app', AppElement);
    }

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
});
