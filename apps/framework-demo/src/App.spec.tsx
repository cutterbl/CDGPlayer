import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createPlayerMock, createControlsModelMock } = vi.hoisted(() => ({
  createPlayerMock: vi.fn(),
  createControlsModelMock: vi.fn(),
}));

vi.mock('@cxing/cdg-player', () => ({
  createPlayer: createPlayerMock,
}));

vi.mock('@cxing/cdg-controls', () => ({
  createControlsModel: createControlsModelMock,
}));

import { App } from './App.js';

type FrameworkViewState = {
  status: string;
  trackId: string | null;
  currentTimeMs: number;
  durationMs: number;
  volume: number;
  playbackRate: number;
  pitchSemitones: number;
  isPlayable: boolean;
  isPlaying: boolean;
  progressPercent: number;
};

const DEFAULT_STATE: FrameworkViewState = {
  status: 'idle',
  trackId: null,
  currentTimeMs: 0,
  durationMs: 0,
  volume: 1,
  playbackRate: 1,
  pitchSemitones: 0,
  isPlayable: false,
  isPlaying: false,
  progressPercent: 0,
};

const createHarness = ({
  loadResult = undefined,
  loadError,
  initialState = DEFAULT_STATE,
}: {
  loadResult?:
    | {
        metadata?: {
          title: string;
          artist: string;
        };
      }
    | undefined;
  loadError?: Error;
  initialState?: FrameworkViewState;
} = {}) => {
  const unsubscribeMock = vi.fn();
  const playerListeners = new Map<string, EventListener>();
  let stateListener = (_state: FrameworkViewState): void => undefined;

  const player = {
    addEventListener: vi.fn((eventName: string, listener: EventListener) => {
      playerListeners.set(eventName, listener);
    }),
    removeEventListener: vi.fn((eventName: string, listener: EventListener) => {
      const current = playerListeners.get(eventName);
      if (current === listener) {
        playerListeners.delete(eventName);
      }
    }),
    stop: vi.fn(),
    load: loadError
      ? vi.fn(async () => {
          throw loadError;
        })
      : vi.fn(async () => loadResult),
    dispose: vi.fn(),
  };

  const controlsModel = {
    subscribe: vi.fn((listener: typeof stateListener) => {
      stateListener = listener;
      listener(initialState);
      return unsubscribeMock;
    }),
    togglePlayPause: vi.fn(async () => undefined),
    seekPercent: vi.fn(),
    setVolume: vi.fn(),
    setTempo: vi.fn(),
    setPitchSemitones: vi.fn(),
    dispose: vi.fn(),
  };

  createPlayerMock.mockReturnValue(player);
  createControlsModelMock.mockReturnValue(controlsModel);

  return {
    player,
    controlsModel,
    unsubscribeMock,
    emitState(nextState: Partial<FrameworkViewState>) {
      act(() => {
        stateListener({
          ...DEFAULT_STATE,
          ...initialState,
          ...nextState,
        });
      });
    },
    emitRenderMetrics(detail: {
      mode: 'main-thread' | 'worker';
      frameCpuMs: number;
      transferredBytes: number;
      atMs: number;
    }) {
      act(() => {
        playerListeners.get('rendermetrics')?.(
          new CustomEvent('rendermetrics', {
            detail,
          }) as unknown as Event,
        );
      });
    },
  };
};

describe('App', () => {
  beforeEach(() => {
    createPlayerMock.mockReset();
    createControlsModelMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the example app and wires file load, transport, settings, perf export, and cleanup', async () => {
    const harness = createHarness({
      loadResult: {
        metadata: {
          title: '   ',
          artist: '   ',
        },
      },
    });

    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:perf-report');
    const revokeObjectUrlSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { container, unmount } = render(<App />);

    expect(screen.getByText('View Source:')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'apps/framework-demo' }),
    ).toBeTruthy();
    expect(screen.getByText('Choose a track to start.')).toBeTruthy();

    harness.emitState({
      status: 'ready',
      trackId: 'demo-track',
      isPlayable: true,
      currentTimeMs: 62_000,
      durationMs: 120_000,
      progressPercent: 51.2,
      volume: 0.8,
      playbackRate: 1.25,
      pitchSemitones: 2,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(harness.controlsModel.togglePlayPause).toHaveBeenCalledTimes(1);

    const progressInput = container.querySelector<HTMLInputElement>(
      'input[type="range"][max="100"]',
    );
    if (!progressInput) {
      throw new Error('Expected transport progress input to exist.');
    }

    fireEvent.change(progressInput, { target: { value: '67.5' } });
    expect(harness.controlsModel.seekPercent).toHaveBeenCalledWith({
      percentage: 67.5,
    });

    fireEvent.change(screen.getByLabelText('Volume'), {
      target: { value: '0.33' },
    });
    expect(harness.controlsModel.setVolume).toHaveBeenCalledWith({
      value: 0.33,
    });

    fireEvent.change(screen.getByLabelText('Tempo'), {
      target: { value: '1.50' },
    });
    expect(harness.controlsModel.setTempo).toHaveBeenCalledWith({ value: 1.5 });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '5' },
    });
    expect(harness.controlsModel.setPitchSemitones).toHaveBeenCalledWith({
      value: 5,
    });

    const canvas = container.querySelector('canvas');
    if (!(canvas?.parentElement instanceof HTMLElement)) {
      throw new Error('Expected stage element to exist.');
    }

    fireEvent.click(canvas.parentElement);
    expect(harness.controlsModel.togglePlayPause).toHaveBeenCalledTimes(2);

    const fileInput = screen.getByLabelText('Select a karaoke zip (.zip)');
    const file = new File(['zip-content'], 'demo-track.zip', {
      type: 'application/zip',
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(harness.player.stop).toHaveBeenCalledOnce();
    });
    expect(harness.player.load).toHaveBeenCalledWith({
      input: { kind: 'file', file },
    });
    expect(await screen.findByText('Track loaded.')).toBeTruthy();
    expect(screen.getByText('Unknown Title')).toBeTruthy();
    expect(screen.getByText('Unknown Artist')).toBeTruthy();

    const exportButton = screen.getByRole('button', {
      name: 'Export speed report (.json)',
    });
    expect((exportButton as HTMLButtonElement).disabled).toBe(true);

    harness.emitRenderMetrics({
      mode: 'worker',
      frameCpuMs: 4.25,
      transferredBytes: 1024,
      atMs: 33,
    });

    expect(screen.getByText(/Speed check \(worker\)/)).toBeTruthy();
    expect((exportButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(exportButton);

    expect(createObjectUrlSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectUrlSpy).toHaveBeenCalledOnce();

    unmount();

    expect(harness.unsubscribeMock).toHaveBeenCalledOnce();
    expect(harness.controlsModel.dispose).toHaveBeenCalledOnce();
    expect(harness.player.dispose).toHaveBeenCalledOnce();
    expect(harness.player.removeEventListener).toHaveBeenCalledWith(
      'rendermetrics',
      expect.any(Function),
    );
  });

  it('shows load failures and ignores invalid stage/settings input branches', async () => {
    const harness = createHarness({
      loadError: new Error('Broken zip'),
    });

    const { container } = render(<App />);

    const canvas = container.querySelector('canvas');
    if (!(canvas?.parentElement instanceof HTMLElement)) {
      throw new Error('Expected stage element to exist.');
    }

    fireEvent.click(canvas.parentElement);
    expect(harness.controlsModel.togglePlayPause).not.toHaveBeenCalled();

    expect((screen.getByLabelText('Volume') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText('Tempo') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(
      true,
    );

    const fileInput = screen.getByLabelText('Select a karaoke zip (.zip)');
    const file = new File(['zip-content'], 'broken-track.zip', {
      type: 'application/zip',
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(await screen.findByText('Load failed: Broken zip')).toBeTruthy();
  });
});
