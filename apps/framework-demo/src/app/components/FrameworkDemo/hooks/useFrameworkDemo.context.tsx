import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type RefObject,
  type SetStateAction,
} from 'react';
import { createPlayer, type CdgPlayer } from '@cxing/cdg-player';
import {
  createControlsModel,
  type CdgControlsModel,
  type ControlsViewState,
} from '@cxing/cdg-controls';

const DEFAULT_STATE: ControlsViewState = {
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

// Keep a short rolling history so our speed check stays helpful and lightweight.
const PERF_SAMPLE_LIMIT = 120;
const STORYBOOK_STORY_CHANGE_EVENT = 'cdg:storybook-story-change';
const STOP_PLAYBACK_MESSAGE_TYPE = 'cdg:stop-playback';

/**
 * One per-frame telemetry sample captured from player render metrics.
 */
type RenderSample = {
  mode: 'main-thread' | 'worker';
  frameCpuMs: number;
  transferredBytes: number;
  atMs: number;
};

/**
 * Lightweight HUD-facing summary for the currently active render mode.
 */
type PerfSummary = {
  mode: string;
  avgCpuMs: number;
  p95CpuMs: number;
  avgTransferredBytes: number;
};

/**
 * Full aggregate summary for one render mode in exported diagnostics.
 */
type RenderModeSummary = {
  sampleCount: number;
  avgFrameCpuMs: number;
  p95FrameCpuMs: number;
  avgTransferredBytes: number;
  maxTransferredBytes: number;
};

/**
 * Serializable diagnostics report used by local debugging/export workflows.
 */
type PerfArtifact = {
  schemaVersion: 1;
  source: string;
  generatedAt: string;
  sampleLimit: number;
  totalSamples: number;
  latestMode: 'main-thread' | 'worker' | null;
  modes: Partial<Record<'main-thread' | 'worker', RenderModeSummary>>;
  samples: RenderSample[];
};

/**
 * Runtime support flags for transport popover features.
 */
type TransportUiFeatureSupport = {
  hasPopoverApi: boolean;
  hasCssAnchorPositioning: boolean;
};

/**
 * Detects browser support for Popover API and CSS Anchor Positioning.
 */
const detectTransportUiFeatureSupport = (): TransportUiFeatureSupport => {
  if (
    typeof window === 'undefined' ||
    typeof HTMLElement === 'undefined' ||
    typeof CSS === 'undefined' ||
    typeof CSS.supports !== 'function'
  ) {
    return {
      hasPopoverApi: false,
      hasCssAnchorPositioning: false,
    };
  }

  const hasPopoverApi =
    'showPopover' in HTMLElement.prototype &&
    'hidePopover' in HTMLElement.prototype;

  const hasCssAnchorPositioning =
    CSS.supports('anchor-name: --cdg-anchor') &&
    CSS.supports('position-anchor: --cdg-anchor') &&
    CSS.supports('top: anchor(bottom)');

  return {
    hasPopoverApi,
    hasCssAnchorPositioning,
  };
};

/**
 * Builds a human-readable compatibility warning for unsupported browsers.
 */
const createTransportUiCompatibilityWarning = (): string | null => {
  const support = detectTransportUiFeatureSupport();

  if (support.hasPopoverApi && support.hasCssAnchorPositioning) {
    return null;
  }

  if (!support.hasPopoverApi && !support.hasCssAnchorPositioning) {
    return 'Warning: This browser does not support Popover API or CSS Anchor Positioning. Transport popovers may not work correctly.';
  }

  if (!support.hasPopoverApi) {
    return 'Warning: This browser does not support the Popover API. Transport popovers may not work correctly.';
  }

  return 'Warning: This browser does not support CSS Anchor Positioning. Transport popovers may not align correctly.';
};

/**
 * Detects localhost runtime so diagnostics are limited to developer sessions.
 */
const isLocalDevelopmentRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
};

/**
 * Aggregates raw frame samples into a mode-specific summary.
 *
 * @param samples Recent samples for one render mode.
 * @returns Null when no samples are available.
 */
const createModeSummary = (
  samples: RenderSample[],
): RenderModeSummary | null => {
  if (samples.length === 0) {
    return null;
  }

  // Sort frame CPU times so percentile selection is deterministic.
  // Teaching note:
  // - avgFrameCpuMs = typical frame cost
  // - p95FrameCpuMs = "how bad spikes get" for the slowest ~5% frames
  // Stutter often shows up in p95 before average looks scary.
  const sortedCpu = samples
    .map((sample) => sample.frameCpuMs)
    .sort((a, b) => a - b);
  const p95Index = Math.min(
    sortedCpu.length - 1,
    Math.floor(sortedCpu.length * 0.95),
  );
  const totalCpu = samples.reduce((sum, sample) => sum + sample.frameCpuMs, 0);
  const totalTransferred = samples.reduce(
    (sum, sample) => sum + sample.transferredBytes,
    0,
  );

  // This summary balances beginner readability with enough detail for mentoring.
  return {
    sampleCount: samples.length,
    avgFrameCpuMs: totalCpu / samples.length,
    p95FrameCpuMs: sortedCpu[p95Index] ?? 0,
    avgTransferredBytes: totalTransferred / samples.length,
    maxTransferredBytes: Math.max(
      ...samples.map((sample) => sample.transferredBytes),
    ),
  };
};

/**
 * Builds the diagnostics artifact containing summary data and raw samples.
 */
const buildPerfArtifact = (samples: RenderSample[]): PerfArtifact => {
  const latest = samples[samples.length - 1] ?? null;
  // Split by mode so "main-thread" and "worker" do not get mixed into one misleading average.
  const mainThreadSamples = samples.filter(
    (sample) => sample.mode === 'main-thread',
  );
  const workerSamples = samples.filter((sample) => sample.mode === 'worker');
  const mainSummary = createModeSummary(mainThreadSamples);
  const workerSummary = createModeSummary(workerSamples);

  // Keep both:
  // - summaries for quick human review
  // - raw samples for deeper analysis or custom charts later
  return {
    schemaVersion: 1,
    source: 'apps/framework-demo',
    generatedAt: new Date().toISOString(),
    sampleLimit: PERF_SAMPLE_LIMIT,
    totalSamples: samples.length,
    latestMode: latest?.mode ?? null,
    modes: {
      ...(mainSummary ? { 'main-thread': mainSummary } : {}),
      ...(workerSummary ? { worker: workerSummary } : {}),
    },
    samples,
  };
};

/**
 * Publishes latest artifact snapshots on global state for DevTools inspection.
 */
const publishPerfArtifact = (samples: RenderSample[]): void => {
  // Expose latest snapshot on global state for easy inspection in DevTools.
  const artifact = buildPerfArtifact(samples);
  const globalState = globalThis as {
    __CDG_PERF_ARTIFACT__?: PerfArtifact;
    __CDG_PERF_ARTIFACTS__?: Record<string, PerfArtifact>;
  };

  globalState.__CDG_PERF_ARTIFACT__ = artifact;
  globalState.__CDG_PERF_ARTIFACTS__ = {
    ...(globalState.__CDG_PERF_ARTIFACTS__ ?? {}),
    [artifact.source]: artifact,
  };
};

/**
 * Downloads the latest diagnostics artifact as a JSON file.
 */
const exportPerfArtifact = (): void => {
  const artifactState = (globalThis as { __CDG_PERF_ARTIFACT__?: PerfArtifact })
    .__CDG_PERF_ARTIFACT__;

  if (!artifactState || artifactState.totalSamples === 0) {
    return;
  }

  // Export lets developers keep a snapshot and compare "before vs after" changes.
  const artifactBlob = new Blob([JSON.stringify(artifactState, null, 2)], {
    type: 'application/json',
  });
  const downloadUrl = URL.createObjectURL(artifactBlob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  link.href = downloadUrl;
  link.download = `cdg-perf-${timestamp}.json`;
  link.click();

  URL.revokeObjectURL(downloadUrl);
};

/**
 * Shared framework demo context contract used by all demo subcomponents.
 */
export type FrameworkDemoContextValue = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  showPerfDiagnostics: boolean;
  compatibilityWarning: string | null;
  statusMessage: string;
  isStatusVisible: boolean;
  player: CdgPlayer | null;
  controlsModel: CdgControlsModel | null;
  viewState: ControlsViewState;
  titleMetadata: { title: string; artist: string } | null;
  setTitleMetadata: Dispatch<
    SetStateAction<{ title: string; artist: string } | null>
  >;
  hasGraphicsTrack: boolean;
  setHasGraphicsTrack: Dispatch<SetStateAction<boolean>>;
  hasVideoTrack: boolean;
  setHasVideoTrack: Dispatch<SetStateAction<boolean>>;
  codecDiagnostic: string | null;
  setCodecDiagnostic: Dispatch<SetStateAction<string | null>>;
  perfSummary: PerfSummary | null;
  hasTrack: boolean;
  showTitle: boolean;
  showStatusMessage: (message: string) => void;
  resetPlaybackStarted: () => void;
  exportPerfArtifact: () => void;
};

const FrameworkDemoContext = createContext<FrameworkDemoContextValue | null>(
  null,
);

/**
 * Initializes player/model state and exposes shared runtime data to child components.
 */
export function FrameworkDemoProvider({ children }: PropsWithChildren) {
  // "Performance diagnostics" is a developer speedometer.
  // 90s analogy: like watching FPS counters to spot why a game feels laggy.
  // Local-only keeps debug numbers out of the real user experience.
  const showPerfDiagnostics = isLocalDevelopmentRuntime();
  const compatibilityWarning = useMemo(
    () => createTransportUiCompatibilityWarning(),
    [],
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const statusFadeTimeoutRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const hasPlaybackStartedRef = useRef(false);

  const [statusMessage, setStatusMessage] = useState(
    'Choose a track to start.',
  );
  const [isStatusVisible, setIsStatusVisible] = useState(true);
  const [player, setPlayer] = useState<CdgPlayer | null>(null);
  const [controlsModel, setControlsModel] = useState<CdgControlsModel | null>(
    null,
  );
  const [viewState, setViewState] = useState<ControlsViewState>(DEFAULT_STATE);
  const [titleMetadata, setTitleMetadata] = useState<{
    title: string;
    artist: string;
  } | null>(null);
  const [hasGraphicsTrack, setHasGraphicsTrack] = useState(true);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [codecDiagnostic, setCodecDiagnostic] = useState<string | null>(null);
  const [perfSummary, setPerfSummary] = useState<PerfSummary | null>(null);

  // Turn many raw timing samples into a tiny report we can read at a glance.
  /**
   * Converts raw samples into a compact, beginner-friendly HUD summary.
   */
  const updatePerfSummary = (samples: RenderSample[]): void => {
    if (samples.length === 0) {
      setPerfSummary(null);
      return;
    }

    const latest = samples[samples.length - 1];
    if (!latest) {
      setPerfSummary(null);
      return;
    }

    // We summarize only the currently active mode in the HUD to keep learning curve gentle.
    // Full multi-mode details are still available in exported artifact JSON.
    const modeSamples = samples.filter((sample) => sample.mode === latest.mode);
    const sortedCpu = modeSamples
      .map((sample) => sample.frameCpuMs)
      .sort((a, b) => a - b);
    const p95Index = Math.min(
      sortedCpu.length - 1,
      Math.floor(sortedCpu.length * 0.95),
    );

    setPerfSummary({
      mode: latest.mode,
      // avgCpuMs = regular frame cost trend
      avgCpuMs:
        modeSamples.reduce((sum, sample) => sum + sample.frameCpuMs, 0) /
        modeSamples.length,
      // p95CpuMs = near-worst frame cost (top 5% slow frames)
      p95CpuMs: sortedCpu[p95Index] ?? 0,
      // avgTransferredBytes helps spot heavy frame payloads
      avgTransferredBytes:
        modeSamples.reduce((sum, sample) => sum + sample.transferredBytes, 0) /
        modeSamples.length,
    });
  };

  /**
   * Shows status text and auto-hides it after a short delay.
   */
  const showStatusMessage = useCallback((message: string): void => {
    setStatusMessage(message);
    setIsStatusVisible(true);

    if (statusFadeTimeoutRef.current !== null) {
      window.clearTimeout(statusFadeTimeoutRef.current);
    }

    statusFadeTimeoutRef.current = window.setTimeout(() => {
      setIsStatusVisible(false);
      statusFadeTimeoutRef.current = null;
    }, 3000);
  }, []);

  /**
   * Resets title-screen visibility tracking before loading a new track.
   */
  const resetPlaybackStarted = useCallback((): void => {
    hasPlaybackStartedRef.current = false;
  }, []);

  useEffect(() => {
    // Wait until refs are attached, then wire canvas/audio into the player runtime.
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!canvas || !audio || !video) {
      return;
    }

    const nextPlayer = createPlayer({
      options: {
        canvas,
        audio,
        video,
        debug: true,
      },
    });

    const nextModel = createControlsModel({
      options: {
        player: nextPlayer,
      },
    });

    setPlayer(nextPlayer);
    setControlsModel(nextModel);

    const renderSamples: RenderSample[] = [];
    const handleRenderMetrics = (event: Event): void => {
      const detail = (event as CustomEvent<RenderSample>).detail;
      // Save one small "how hard was that frame?" sample.
      renderSamples.push({
        mode: detail.mode,
        frameCpuMs: detail.frameCpuMs,
        transferredBytes: detail.transferredBytes,
        atMs: detail.atMs,
      });

      // Keep memory bounded by dropping oldest samples once we hit the cap.
      if (renderSamples.length > PERF_SAMPLE_LIMIT) {
        renderSamples.splice(0, renderSamples.length - PERF_SAMPLE_LIMIT);
      }

      updatePerfSummary(renderSamples);
      publishPerfArtifact(renderSamples);
    };

    if (showPerfDiagnostics) {
      nextPlayer.addEventListener('rendermetrics', handleRenderMetrics);
    }

    const unsubscribe = nextModel.subscribe((state) => {
      // Model subscription is the single source of truth for transport/status UI.
      if (state.status !== lastStatusRef.current) {
        showStatusMessage(`Status: ${state.status}`);
        lastStatusRef.current = state.status;
      }

      if (state.status === 'playing') {
        hasPlaybackStartedRef.current = true;
      }

      setViewState(state);
    });

    showStatusMessage('Choose a track to start.');
    if (showPerfDiagnostics) {
      publishPerfArtifact(renderSamples);
    }

    return () => {
      // Cleanup all listeners/resources created by this effect.
      if (statusFadeTimeoutRef.current !== null) {
        window.clearTimeout(statusFadeTimeoutRef.current);
        statusFadeTimeoutRef.current = null;
      }

      unsubscribe();
      if (showPerfDiagnostics) {
        nextPlayer.removeEventListener('rendermetrics', handleRenderMetrics);
      }
      nextModel.dispose();
      nextPlayer.dispose();
      setPlayer(null);
      setControlsModel(null);
      setPerfSummary(null);
    };
  }, []);

  useEffect(() => {
    if (!player) {
      return;
    }

    const stopPlaybackForNavigation = (): void => {
      player.stop();
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        stopPlaybackForNavigation();
      }
    };

    const handleWindowMessage = (event: MessageEvent<unknown>): void => {
      const payload = event.data;
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'type' in payload &&
        payload.type === STOP_PLAYBACK_MESSAGE_TYPE
      ) {
        stopPlaybackForNavigation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', stopPlaybackForNavigation);
    window.addEventListener('beforeunload', stopPlaybackForNavigation);
    window.addEventListener(
      STORYBOOK_STORY_CHANGE_EVENT,
      stopPlaybackForNavigation,
    );
    window.addEventListener('message', handleWindowMessage);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', stopPlaybackForNavigation);
      window.removeEventListener('beforeunload', stopPlaybackForNavigation);
      window.removeEventListener(
        STORYBOOK_STORY_CHANGE_EVENT,
        stopPlaybackForNavigation,
      );
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [player]);

  const showTitle = useMemo(() => {
    // Show metadata in "ready" state until playback actually starts.
    const showMetadata =
      viewState.status === 'ready' &&
      titleMetadata !== null &&
      !hasPlaybackStartedRef.current;

    if (showMetadata) {
      return true;
    }

    return (
      viewState.status === 'idle' ||
      viewState.status === 'loading' ||
      viewState.status === 'error'
    );
  }, [viewState.status, titleMetadata]);

  const hasTrack =
    viewState.status === 'ready' ||
    viewState.status === 'playing' ||
    viewState.status === 'paused';

  const contextValue = useMemo<FrameworkDemoContextValue>(
    () => ({
      canvasRef,
      audioRef,
      videoRef,
      showPerfDiagnostics,
      compatibilityWarning,
      statusMessage,
      isStatusVisible,
      player,
      controlsModel,
      viewState,
      titleMetadata,
      setTitleMetadata,
      hasGraphicsTrack,
      setHasGraphicsTrack,
      hasVideoTrack,
      setHasVideoTrack,
      codecDiagnostic,
      setCodecDiagnostic,
      perfSummary,
      hasTrack,
      showTitle,
      showStatusMessage,
      resetPlaybackStarted,
      exportPerfArtifact,
    }),
    [
      showPerfDiagnostics,
      compatibilityWarning,
      statusMessage,
      isStatusVisible,
      player,
      controlsModel,
      viewState,
      titleMetadata,
      hasGraphicsTrack,
      hasVideoTrack,
      codecDiagnostic,
      perfSummary,
      hasTrack,
      showTitle,
      showStatusMessage,
      resetPlaybackStarted,
    ],
  );

  return (
    // Expose shared player/model state to child hooks/components.
    <FrameworkDemoContext.Provider value={contextValue}>
      {children}
    </FrameworkDemoContext.Provider>
  );
}

/**
 * Reads the framework demo context and enforces provider usage at runtime.
 */
export default function useFrameworkDemoContext(): FrameworkDemoContextValue {
  const contextValue = useContext(FrameworkDemoContext);
  if (!contextValue) {
    throw new Error(
      'useFrameworkDemoContext must be used inside FrameworkDemoProvider.',
    );
  }

  return contextValue;
}
