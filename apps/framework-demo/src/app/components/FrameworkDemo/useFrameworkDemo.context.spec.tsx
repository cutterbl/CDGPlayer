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

vi.mock('@cxing/media-player', () => ({
  createPlayer: createPlayerMock,
}));

vi.mock('@cxing/media-playback-controls', () => ({
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

type FrameworkStateListener = (state: FrameworkViewState) => void;

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
  let stateListener: FrameworkStateListener | undefined;

  const player = {
    addEventListener: vi.fn((eventName: string, listener: EventListener) => {
      playerListeners.set(eventName, listener);
    }),
    removeEventListener: vi.fn((eventName: string, listener: EventListener) => {
      if (playerListeners.get(eventName) === listener) {
        playerListeners.delete(eventName);
      }
    }),
    stop: vi.fn(),
    dispose: vi.fn(),
  };

  const controlsModel = {
    subscribe: vi.fn((listener: FrameworkStateListener) => {
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
        stateListener?.({
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
      <video ref={context.videoRef} preload="auto" playsInline />
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
      <div data-testid="compatibility-warning">
        {context.compatibilityWarning ?? ''}
      </div>
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

  it('stops playback for navigation events and ignores unrelated visibility or message events', () => {
    const harness = createHarness();
    const visibilityStateDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'visibilityState',
    );
    let visibilityState: DocumentVisibilityState = 'visible';

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    try {
      const { unmount } = render(
        <FrameworkDemoProvider>
          <ProviderConsumer />
        </FrameworkDemoProvider>,
      );

      fireEvent(document, new Event('visibilitychange'));
      window.dispatchEvent(new MessageEvent('message', { data: null }));
      window.dispatchEvent(new MessageEvent('message', { data: 'ignore-me' }));
      window.dispatchEvent(new MessageEvent('message', { data: {} }));
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'not-stop-playback' },
        }),
      );

      expect(harness.player.stop).not.toHaveBeenCalled();

      visibilityState = 'hidden';
      fireEvent(document, new Event('visibilitychange'));
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'cdg:stop-playback' },
        }),
      );

      expect(harness.player.stop).toHaveBeenCalledTimes(2);

      unmount();
    } finally {
      if (visibilityStateDescriptor) {
        Object.defineProperty(
          Document.prototype,
          'visibilityState',
          visibilityStateDescriptor,
        );
      } else {
        Reflect.deleteProperty(document, 'visibilityState');
      }
    }
  });

  it('throws when consumed outside the provider', () => {
    expect(() => renderHook(() => useFrameworkDemoContext())).toThrow(
      'useFrameworkDemoContext must be used inside FrameworkDemoProvider.',
    );
  });

  it('computes compatibility warning from browser feature support', () => {
    const originalCssDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'CSS',
    );
    const showPopoverDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'showPopover',
    );
    const hidePopoverDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'hidePopover',
    );

    try {
      Object.defineProperty(globalThis, 'CSS', {
        configurable: true,
        writable: true,
        value: {
          supports: vi.fn(
            (query: string) =>
              query === 'anchor-name: --cdg-anchor' ||
              query === 'position-anchor: --cdg-anchor' ||
              query === 'top: anchor(bottom)',
          ),
        },
      });

      Object.defineProperty(HTMLElement.prototype, 'showPopover', {
        configurable: true,
        value: vi.fn(),
      });
      Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
        configurable: true,
        value: vi.fn(),
      });

      const harness = createHarness();
      const { unmount } = render(
        <FrameworkDemoProvider>
          <ProviderConsumer />
        </FrameworkDemoProvider>,
      );

      expect(screen.getByTestId('compatibility-warning').textContent).toBe('');

      unmount();
      expect(harness.unsubscribeMock).toHaveBeenCalledOnce();
    } finally {
      if (showPopoverDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'showPopover',
          showPopoverDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
      }

      if (hidePopoverDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'hidePopover',
          hidePopoverDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
      }

      if (originalCssDescriptor) {
        Object.defineProperty(globalThis, 'CSS', originalCssDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'CSS');
      }
    }
  });

  it('reports popover-specific compatibility warning when popover API is unavailable', () => {
    const originalCssDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'CSS',
    );
    const showPopoverDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'showPopover',
    );
    const hidePopoverDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'hidePopover',
    );

    try {
      Object.defineProperty(globalThis, 'CSS', {
        configurable: true,
        writable: true,
        value: {
          supports: vi.fn(() => true),
        },
      });

      Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
      Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');

      const harness = createHarness();
      const { unmount } = render(
        <FrameworkDemoProvider>
          <ProviderConsumer />
        </FrameworkDemoProvider>,
      );

      expect(screen.getByTestId('compatibility-warning').textContent).toContain(
        'does not support the Popover API',
      );

      unmount();
      expect(harness.unsubscribeMock).toHaveBeenCalledOnce();
    } finally {
      if (showPopoverDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'showPopover',
          showPopoverDescriptor,
        );
      }

      if (hidePopoverDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'hidePopover',
          hidePopoverDescriptor,
        );
      }

      if (originalCssDescriptor) {
        Object.defineProperty(globalThis, 'CSS', originalCssDescriptor);
      }
    }
  });

  it('reports anchor-positioning warning when popover API exists but CSS anchor support is missing', () => {
    const originalCssDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'CSS',
    );
    const showPopoverDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'showPopover',
    );
    const hidePopoverDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'hidePopover',
    );

    try {
      Object.defineProperty(globalThis, 'CSS', {
        configurable: true,
        writable: true,
        value: {
          supports: vi.fn(() => false),
        },
      });

      Object.defineProperty(HTMLElement.prototype, 'showPopover', {
        configurable: true,
        value: vi.fn(),
      });
      Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
        configurable: true,
        value: vi.fn(),
      });

      const harness = createHarness();
      const { unmount } = render(
        <FrameworkDemoProvider>
          <ProviderConsumer />
        </FrameworkDemoProvider>,
      );

      expect(screen.getByTestId('compatibility-warning').textContent).toContain(
        'does not support CSS Anchor Positioning',
      );

      unmount();
      expect(harness.unsubscribeMock).toHaveBeenCalledOnce();
    } finally {
      if (showPopoverDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'showPopover',
          showPopoverDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
      }

      if (hidePopoverDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'hidePopover',
          hidePopoverDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
      }

      if (originalCssDescriptor) {
        Object.defineProperty(globalThis, 'CSS', originalCssDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'CSS');
      }
    }
  });

  it('reports combined compatibility warning when both popover and anchor support are unavailable', () => {
    const originalCssDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'CSS',
    );
    const showPopoverDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'showPopover',
    );
    const hidePopoverDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'hidePopover',
    );

    try {
      Object.defineProperty(globalThis, 'CSS', {
        configurable: true,
        writable: true,
        value: {
          supports: vi.fn(() => false),
        },
      });

      Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
      Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');

      const harness = createHarness();
      const { unmount } = render(
        <FrameworkDemoProvider>
          <ProviderConsumer />
        </FrameworkDemoProvider>,
      );

      expect(screen.getByTestId('compatibility-warning').textContent).toContain(
        'does not support Popover API or CSS Anchor Positioning',
      );

      unmount();
      expect(harness.unsubscribeMock).toHaveBeenCalledOnce();
    } finally {
      if (showPopoverDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'showPopover',
          showPopoverDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
      }

      if (hidePopoverDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'hidePopover',
          hidePopoverDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
      }

      if (originalCssDescriptor) {
        Object.defineProperty(globalThis, 'CSS', originalCssDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'CSS');
      }
    }
  });
});
