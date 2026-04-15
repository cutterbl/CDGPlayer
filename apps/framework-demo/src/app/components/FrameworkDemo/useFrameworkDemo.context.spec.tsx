import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
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

import useFrameworkDemoContext, {
  FrameworkDemoProvider,
} from './hooks/useFrameworkDemo.context';

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

const createHarness = ({ initialState = DEFAULT_STATE } = {}) => {
  const unsubscribeMock = vi.fn();
  const playerListeners = new Map<string, EventListener>();
  let stateListener = (_state: FrameworkViewState): void => undefined;

  const player = {
    addEventListener: vi.fn((eventName: string, listener: EventListener) => {
      playerListeners.set(eventName, listener);
    }),
    removeEventListener: vi.fn((eventName: string, listener: EventListener) => {
      if (playerListeners.get(eventName) === listener) {
        playerListeners.delete(eventName);
      }
    }),
    dispose: vi.fn(),
  };

  const controlsModel = {
    subscribe: vi.fn((listener: typeof stateListener) => {
      stateListener = listener;
      listener(initialState);
      return unsubscribeMock;
    }),
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

function ProviderConsumer() {
  const context = useFrameworkDemoContext();

  return (
    <>
      <canvas ref={context.canvasRef} width={300} height={216} />
      <audio ref={context.audioRef} preload="auto" />
      <button
        type="button"
        onClick={() => context.showStatusMessage('Manual status')}
      >
        show status
      </button>
      <button type="button" onClick={() => context.exportPerfArtifact()}>
        export perf
      </button>
      <div data-testid="status-message">{context.statusMessage}</div>
      <div data-testid="status-visible">{String(context.isStatusVisible)}</div>
      <div data-testid="perf-mode">{context.perfSummary?.mode ?? 'none'}</div>
    </>
  );
}

describe('useFrameworkDemoContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createPlayerMock.mockReset();
    createControlsModelMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('publishes perf summaries, guards empty exports, and fades status messages', () => {
    const harness = createHarness();
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:perf-report');
    const revokeObjectUrlSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { unmount } = render(
      <FrameworkDemoProvider>
        <ProviderConsumer />
      </FrameworkDemoProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'export perf' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();

    harness.emitState({ status: 'ready' });
    harness.emitRenderMetrics({
      mode: 'worker',
      frameCpuMs: 6.4,
      transferredBytes: 1024,
      atMs: 16,
    });
    harness.emitRenderMetrics({
      mode: 'worker',
      frameCpuMs: 4.2,
      transferredBytes: 512,
      atMs: 33,
    });

    expect(screen.getByTestId('perf-mode').textContent).toBe('worker');

    fireEvent.click(screen.getByRole('button', { name: 'export perf' }));
    expect(createObjectUrlSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectUrlSpy).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'show status' }));
    expect(screen.getByTestId('status-message').textContent).toBe(
      'Manual status',
    );
    expect(screen.getByTestId('status-visible').textContent).toBe('true');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId('status-visible').textContent).toBe('false');

    unmount();
    expect(harness.unsubscribeMock).toHaveBeenCalledOnce();
    expect(harness.controlsModel.dispose).toHaveBeenCalledOnce();
    expect(harness.player.dispose).toHaveBeenCalledOnce();
  });

  it('throws when consumed outside the provider', () => {
    expect(() => renderHook(() => useFrameworkDemoContext())).toThrow(
      'useFrameworkDemoContext must be used inside FrameworkDemoProvider.',
    );
  });
});
