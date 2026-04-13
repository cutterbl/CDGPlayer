import './app.element.css';
import {
  createPlayer,
  type CdgPlayer,
  type PlayerRenderMetricsDetail,
} from '@cxing/cdg-player';
import {
  createControlsModel,
  createCurrentTimeDisplay,
  createDurationDisplay,
  createKeyControl,
  createPlayPauseControl,
  createProgressControl,
  createTempoControl,
  createVolumeControl,
  type CdgControlsModel,
  type DisposableControl,
} from '@cxing/cdg-controls';

/**
 * Shared debug logger for the framework-agnostic demo.
 */
const debugLog = (...args: unknown[]): void => {
  console.log('[demo]', ...args);
};

// "Performance diagnostics" is just a speed report card for the player.
// Think 90s PC gaming: if frame time gets too high, playback can feel choppy.
// We only show this in local development so end users never see debug numbers.
/**
 * Detects localhost runtime so diagnostics UI is shown only in local development.
 */
const isLocalDevelopmentRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
};

// Keep only recent samples (about the last couple of seconds) so this stays lightweight.
const PERF_SAMPLE_LIMIT = 120;
const FRAMEWORK_AGNOSTIC_SOURCE_URL =
  'https://github.com/cutterbl/CDGPlayer/tree/main/apps/demo';

/**
 * Builds the reusable DOM template for the custom element shell.
 *
 * @param showPerfDiagnostics Whether to include local diagnostics controls/overlays.
 */
const createAppTemplate = ({
  showPerfDiagnostics,
}: {
  showPerfDiagnostics: boolean;
}): HTMLTemplateElement => {
  // We build the UI as a reusable <template> so we can clone the exact same DOM
  // whenever this custom element mounts. This keeps app and Storybook rendering
  // consistent, avoids large string assignment inside lifecycle code, and prevents
  // subtle "partial DOM" issues during setup.
  const template = document.createElement('template');
  template.innerHTML = `
    <div class="app-shell" data-role="app-shell">
      <div class="source-link-row" data-role="source-link-row">
        <span class="source-link-label">View Source:</span>
        <a
          class="source-link"
          href="${FRAMEWORK_AGNOSTIC_SOURCE_URL}"
          target="_blank"
          rel="noreferrer"
        >
          apps/demo
        </a>
      </div>
      <div class="file-select-container" data-role="file-select-container">
        <label class="file-picker" for="track-input">Select a karaoke zip (.zip)</label>
        <input id="track-input" type="file" accept=".zip,application/zip" />
        ${showPerfDiagnostics ? '<button type="button" class="perf-export-button" data-role="perf-export">Export speed report (.json)</button>' : ''}
      </div>

      <div class="cdg-player" data-role="player-shell">
        <div class="transport-bar" data-role="transport-bar"></div>
        <div class="stage" data-role="stage">
          <div class="settings-panel" data-role="settings-panel"></div>
          <div class="titleImage" data-role="title-image" aria-hidden="true">
            <div class="titleMeta" data-role="title-meta">
              <div class="titleMetaTitle" data-role="title-meta-title"></div>
              <div class="titleMetaArtist" data-role="title-meta-artist"></div>
            </div>
          </div>
          <canvas data-role="canvas" width="300" height="216"></canvas>
          <div class="status" data-role="status">Choose a track to start.</div>
          ${showPerfDiagnostics ? '<div class="perfHud" data-role="perf-hud">Render: waiting for samples...</div>' : ''}
        </div>

        <audio data-role="audio" preload="auto"></audio>
      </div>
    </div>
  `;

  return template;
};

// Pre-create both template variants once, then clone on connect for speed + consistency.
const baseAppTemplate = createAppTemplate({ showPerfDiagnostics: false });
const perfAppTemplate = createAppTemplate({ showPerfDiagnostics: true });

/**
 * One renderer telemetry sample captured for a single frame.
 *
 * @property mode Which rendering pipeline produced the frame.
 * @property frameCpuMs CPU time spent producing this frame in milliseconds.
 * @property transferredBytes Payload size moved for this frame.
 * @property atMs Player-relative timestamp for when the sample was recorded.
 */
type RenderSample = {
  mode: 'main-thread' | 'worker';
  frameCpuMs: number;
  transferredBytes: number;
  atMs: number;
};

/**
 * Rollup metrics for a single render mode across recent samples.
 */
type RenderModeSummary = {
  sampleCount: number;
  avgFrameCpuMs: number;
  p95FrameCpuMs: number;
  avgTransferredBytes: number;
  maxTransferredBytes: number;
};

/**
 * Exportable diagnostics artifact used for local debugging and comparisons.
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
 * Framework-agnostic custom element that hosts the full CDG demo UI.
 */
export class AppElement extends HTMLElement {
  public static observedAttributes = [];

  private player: CdgPlayer | null = null;
  private controlsModel: CdgControlsModel | null = null;
  private controlsParts: DisposableControl[] = [];
  private controlsUnsubscribe: (() => void) | null = null;
  private statusElement: HTMLElement | null = null;
  private titleImage: HTMLElement | null = null;
  private titleMeta: HTMLElement | null = null;
  private titleMetaTitle: HTMLElement | null = null;
  private titleMetaArtist: HTMLElement | null = null;
  private perfElement: HTMLElement | null = null;
  private perfExportButton: HTMLButtonElement | null = null;
  private appShell: HTMLElement | null = null;
  private lastStatus: string | null = null;
  private statusFadeTimeoutId: number | null = null;
  private hasPlaybackStarted = false;
  private readonly showPerfDiagnostics = isLocalDevelopmentRuntime();
  private renderSamples: RenderSample[] = [];

  /**
   * Custom element lifecycle teardown: dispose listeners, controls, and player resources.
   */
  disconnectedCallback(): void {
    // Custom element teardown: remove listeners/disposables to avoid memory leaks.
    this.controlsUnsubscribe?.();
    this.controlsUnsubscribe = null;

    this.clearStatusFadeTimeout();

    for (const part of this.controlsParts) {
      part.dispose();
    }
    this.controlsParts = [];

    this.controlsModel?.dispose();
    this.controlsModel = null;

    this.player?.dispose();
    this.player = null;
  }

  /**
   * Custom element lifecycle setup: clone template and initialize runtime wiring.
   */
  connectedCallback() {
    // Clone a fresh DOM tree for this element instance.
    const template = this.showPerfDiagnostics
      ? perfAppTemplate
      : baseAppTemplate;
    this.replaceChildren(template.content.cloneNode(true));

    // Once DOM is present, wire browser elements to player/controls logic.
    this.initializeDemo();
  }

  /**
   * Queries required DOM nodes and wires player + controls + UI event handlers.
   */
  private initializeDemo(): void {
    // Query all DOM nodes this demo needs up front.
    const canvas = this.querySelector<HTMLCanvasElement>(
      '[data-role="canvas"]',
    );
    const audio = this.querySelector<HTMLAudioElement>('[data-role="audio"]');
    const transportContainer = this.querySelector<HTMLElement>(
      '[data-role="transport-bar"]',
    );
    const stage = this.querySelector<HTMLElement>('[data-role="stage"]');
    const settingsContainer = this.querySelector<HTMLElement>(
      '[data-role="settings-panel"]',
    );
    const fileInput = this.querySelector<HTMLInputElement>('#track-input');
    this.statusElement = this.querySelector<HTMLElement>(
      '[data-role="status"]',
    );
    this.appShell = this.querySelector<HTMLElement>('[data-role="app-shell"]');
    this.titleImage = this.querySelector<HTMLElement>(
      '[data-role="title-image"]',
    );
    this.titleMeta = this.querySelector<HTMLElement>(
      '[data-role="title-meta"]',
    );
    this.titleMetaTitle = this.querySelector<HTMLElement>(
      '[data-role="title-meta-title"]',
    );
    this.titleMetaArtist = this.querySelector<HTMLElement>(
      '[data-role="title-meta-artist"]',
    );
    this.perfElement = this.querySelector<HTMLElement>(
      '[data-role="perf-hud"]',
    );
    this.perfExportButton = this.querySelector<HTMLButtonElement>(
      '[data-role="perf-export"]',
    );

    if (
      !canvas ||
      !audio ||
      !transportContainer ||
      !stage ||
      !settingsContainer ||
      !fileInput ||
      !this.statusElement
    ) {
      // If required nodes are missing, bail out safely rather than half-initialize.
      return;
    }

    try {
      // createPlayer wires audio + canvas rendering into one runtime object.
      this.player = createPlayer({
        options: {
          canvas,
          audio,
        },
      });

      // Controls model is the shared state/action layer used by all UI controls.
      this.controlsModel = createControlsModel({
        options: {
          player: this.player,
        },
      });

      this.controlsParts = [
        // Each helper mounts one UI control into an existing container element.
        createPlayPauseControl({
          container: transportContainer,
          model: this.controlsModel,
        }),
        createCurrentTimeDisplay({
          container: transportContainer,
          model: this.controlsModel,
        }),
        createProgressControl({
          container: transportContainer,
          model: this.controlsModel,
        }),
        createDurationDisplay({
          container: transportContainer,
          model: this.controlsModel,
        }),
        createVolumeControl({
          container: settingsContainer,
          model: this.controlsModel,
          orientation: 'vertical',
        }),
        createTempoControl({
          container: settingsContainer,
          model: this.controlsModel,
          orientation: 'vertical',
        }),
        createKeyControl({
          container: settingsContainer,
          model: this.controlsModel,
        }),
      ];

      this.controlsUnsubscribe = this.controlsModel.subscribe((state) => {
        // Keep lightweight view/UI sync in one place as controls state changes.
        if (state.status !== this.lastStatus) {
          this.setStatusMessage(`Status: ${state.status}`);
          this.lastStatus = state.status;
        }

        this.syncTitleImage(state.status);
        this.syncLayout(state.status);
      });

      this.player.addEventListener('statechange', () => {
        const state = this.player?.getState();
        if (!state) {
          return;
        }

        if (state.status === 'playing') {
          this.hasPlaybackStarted = true;
        }

        debugLog('statechange', state);
      });

      if (this.showPerfDiagnostics) {
        // Save tiny timing snapshots so we can answer:
        // "Is this running smoothly, or is this machine struggling?"
        this.player.addEventListener('rendermetrics', (event: Event) => {
          const detail = (event as CustomEvent<PlayerRenderMetricsDetail>)
            .detail;
          this.recordRenderMetrics(detail);
        });
      }

      this.setStatusMessage('Choose a track to start.');
      if (this.showPerfDiagnostics) {
        this.updatePerfHud();
        this.syncPerfExportButton();
      }
      this.syncTitleImage('idle');
      this.syncLayout('idle');

      stage.addEventListener('click', (event) => {
        // Stage click toggles play/pause, except when interacting with floating settings.
        const clickTarget = event.target;
        if (
          clickTarget instanceof Node &&
          settingsContainer.contains(clickTarget)
        ) {
          return;
        }

        void this.controlsModel?.togglePlayPause();
      });

      fileInput.addEventListener('change', () => {
        // File input is our "load track" entrypoint in the framework-agnostic demo.
        const selectedFile = fileInput.files?.item(0);
        debugLog('file input changed', {
          selected: selectedFile?.name ?? null,
          size: selectedFile?.size ?? null,
          type: selectedFile?.type ?? null,
        });

        if (!selectedFile || !this.player) {
          debugLog('file selection ignored', {
            hasFile: Boolean(selectedFile),
            hasPlayer: Boolean(this.player),
          });
          return;
        }

        this.player.stop();
        this.hasPlaybackStarted = false;
        this.setTitleMetadata(null);
        this.syncTitleImage('loading');
        this.syncLayout('loading');
        this.setStatusMessage('Loading track...');
        debugLog('calling player.load', selectedFile.name);
        void this.player
          .load({
            input: { kind: 'file', file: selectedFile },
          })
          .then((loadedTrack) => {
            // Player returns parsed metadata (title/artist) when available.
            debugLog('player.load resolved', selectedFile.name);
            debugLog('loaded metadata', loadedTrack?.metadata ?? null);
            const metadata = loadedTrack?.metadata;
            if (metadata) {
              this.setTitleMetadata({
                title: metadata.title,
                artist: metadata.artist,
              });
            }

            this.hasPlaybackStarted = false;
            this.syncTitleImage('ready');
            this.setStatusMessage('Track loaded.');
          })
          .catch((errorValue: unknown) => {
            // Show a user-facing status, but keep detailed error info in debug logs.
            const message =
              errorValue instanceof Error
                ? errorValue.message
                : 'Unknown load error';
            debugLog('player.load rejected', {
              file: selectedFile.name,
              error: errorValue,
              message,
            });
            this.setStatusMessage(`Load failed: ${message}`);
            this.syncTitleImage('error');
            this.syncLayout('error');
          })
          .finally(() => {
            fileInput.value = '';
          });
      });

      if (this.showPerfDiagnostics) {
        this.perfExportButton?.addEventListener('click', () => {
          this.exportPerfArtifact();
        });
      }
    } catch (errorValue: unknown) {
      // Initialization errors should fail gracefully with a visible status message.
      const message =
        errorValue instanceof Error
          ? errorValue.message
          : 'Unknown initialization error';
      this.setStatusMessage(`Demo unavailable: ${message}`);
      this.syncTitleImage('error');
      this.syncLayout('error');
    }
  }

  /**
   * Clears any pending status auto-hide timeout.
   */
  private clearStatusFadeTimeout(): void {
    if (this.statusFadeTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.statusFadeTimeoutId);
    this.statusFadeTimeoutId = null;
  }

  /**
   * Shows a transient status message over the stage.
   *
   * @param message Human-readable status text.
   */
  private setStatusMessage(message: string): void {
    if (!this.statusElement) {
      return;
    }

    this.clearStatusFadeTimeout();
    this.statusElement.textContent = message;
    this.statusElement.classList.add('is-visible');

    // Auto-hide status text after a short delay to keep the stage uncluttered.
    this.statusFadeTimeoutId = window.setTimeout(() => {
      this.statusElement?.classList.remove('is-visible');
      this.statusFadeTimeoutId = null;
    }, 3000);
  }

  /**
   * Updates title/artist metadata text and metadata visibility state.
   *
   * @param metadata Parsed track metadata, or null to clear.
   */
  private setTitleMetadata(
    metadata: { title: string; artist: string } | null,
  ): void {
    if (
      !this.titleImage ||
      !this.titleMeta ||
      !this.titleMetaTitle ||
      !this.titleMetaArtist
    ) {
      return;
    }

    if (!metadata) {
      this.titleImage.classList.remove('show-metadata');
      this.titleMetaTitle.textContent = '';
      this.titleMetaArtist.textContent = '';
      return;
    }

    const title = metadata.title.trim();
    const artist = metadata.artist.trim();

    this.titleMetaTitle.textContent = title || 'Unknown Title';
    this.titleMetaArtist.textContent = artist || 'Unknown Artist';
    this.titleImage.classList.add('show-metadata');
  }

  /**
   * Syncs title image visibility based on current playback status.
   *
   * @param status Current player status from controls model state.
   */
  private syncTitleImage(status: string): void {
    if (!this.titleImage) {
      return;
    }

    // Show title art/metadata before playback starts, hide once lyrics/video are active.
    const showMetadata =
      status === 'ready' &&
      this.titleImage.classList.contains('show-metadata') &&
      !this.hasPlaybackStarted;

    if (showMetadata) {
      this.titleImage.classList.remove('hide');
      return;
    }

    if (status === 'idle' || status === 'loading' || status === 'error') {
      this.titleImage.classList.remove('hide');
      return;
    }

    this.titleImage.classList.add('hide');
  }

  /**
   * Applies shell CSS state classes according to playback status.
   *
   * @param status Current player status from controls model state.
   */
  private syncLayout(status: string): void {
    if (!this.appShell) {
      return;
    }

    // CSS class toggles drive major layout transitions (idle, loaded, playing).
    const shouldShowPlayer = status !== 'idle';
    this.appShell.classList.toggle('show-player', shouldShowPlayer);
    this.appShell.classList.toggle('is-playing', status === 'playing');

    if (status === 'ready' || status === 'playing' || status === 'paused') {
      this.appShell.classList.add('has-track');
      return;
    }

    this.appShell.classList.remove('has-track');
  }

  /**
   * Records one render telemetry event, keeps the sample window bounded,
   * then refreshes all diagnostics outputs (global artifact, HUD, export state).
   */
  private recordRenderMetrics(detail: PlayerRenderMetricsDetail): void {
    if (!this.showPerfDiagnostics || !detail) {
      return;
    }

    this.renderSamples.push({
      mode: detail.mode,
      frameCpuMs: detail.frameCpuMs,
      transferredBytes: detail.transferredBytes,
      atMs: detail.atMs,
    });

    // Cap history so this does not grow forever in memory.
    if (this.renderSamples.length > PERF_SAMPLE_LIMIT) {
      this.renderSamples.splice(
        0,
        this.renderSamples.length - PERF_SAMPLE_LIMIT,
      );
    }

    this.publishPerfArtifact();
    this.updatePerfHud();
    this.syncPerfExportButton();
  }

  /**
   * Builds summary stats for one render mode.
   *
   * @param samples Recent samples from a single mode.
   * @returns Null when no samples exist, otherwise aggregate avg/p95/bytes metrics.
   */
  private createModeSummary(samples: RenderSample[]): RenderModeSummary | null {
    if (samples.length === 0) {
      return null;
    }

    // Sort CPU timings so percentile math is easy.
    // Mentorship note:
    // - average shows the "typical" frame cost
    // - p95 shows the "worst spikes" (top 5% slow frames)
    // If avg is fine but p95 is high, users may feel occasional stutter.
    const sortedCpu = samples
      .map((sample) => sample.frameCpuMs)
      .sort((a, b) => a - b);
    const p95Index = Math.min(
      sortedCpu.length - 1,
      Math.floor(sortedCpu.length * 0.95),
    );
    const totalCpu = samples.reduce(
      (sum, sample) => sum + sample.frameCpuMs,
      0,
    );
    const totalTransferred = samples.reduce(
      (sum, sample) => sum + sample.transferredBytes,
      0,
    );

    // Each field answers a practical question for new developers:
    // - sampleCount: how much evidence we have
    // - avgFrameCpuMs: normal frame cost trend
    // - p95FrameCpuMs: spike detector for rough playback moments
    // - avgTransferredBytes/maxTransferredBytes: data movement pressure
    return {
      sampleCount: samples.length,
      avgFrameCpuMs: totalCpu / samples.length,
      p95FrameCpuMs: sortedCpu[p95Index] ?? 0,
      avgTransferredBytes: totalTransferred / samples.length,
      maxTransferredBytes: Math.max(
        ...samples.map((sample) => sample.transferredBytes),
      ),
    };
  }

  /**
   * Builds the current diagnostics report object (summary + raw samples).
   */
  private buildPerfArtifact(): PerfArtifact {
    const latest = this.renderSamples[this.renderSamples.length - 1] ?? null;
    // We split by render mode because "main-thread" and "worker" are different pipelines.
    // Comparing them helps explain whether off-main-thread rendering is helping.
    const mainThreadSamples = this.renderSamples.filter(
      (sample) => sample.mode === 'main-thread',
    );
    const workerSamples = this.renderSamples.filter(
      (sample) => sample.mode === 'worker',
    );
    const mainSummary = this.createModeSummary(mainThreadSamples);
    const workerSummary = this.createModeSummary(workerSamples);

    // Artifact is intentionally "report-like": summary for quick reading + raw samples for deep dives.
    return {
      schemaVersion: 1,
      source: 'apps/demo',
      generatedAt: new Date().toISOString(),
      sampleLimit: PERF_SAMPLE_LIMIT,
      totalSamples: this.renderSamples.length,
      latestMode: latest?.mode ?? null,
      modes: {
        ...(mainSummary ? { 'main-thread': mainSummary } : {}),
        ...(workerSummary ? { worker: workerSummary } : {}),
      },
      samples: this.renderSamples,
    };
  }

  /**
   * Publishes the latest diagnostics artifact onto global state for DevTools inspection.
   */
  private publishPerfArtifact(): void {
    // Make the latest speed report easy to inspect from DevTools while testing locally.
    const artifact = this.buildPerfArtifact();
    const globalState = globalThis as {
      __CDG_PERF_ARTIFACT__?: PerfArtifact;
      __CDG_PERF_ARTIFACTS__?: Record<string, PerfArtifact>;
    };

    globalState.__CDG_PERF_ARTIFACT__ = artifact;
    globalState.__CDG_PERF_ARTIFACTS__ = {
      ...(globalState.__CDG_PERF_ARTIFACTS__ ?? {}),
      [artifact.source]: artifact,
    };
  }

  /**
   * Enables export only when there is at least one captured sample.
   */
  private syncPerfExportButton(): void {
    if (!this.perfExportButton) {
      return;
    }

    this.perfExportButton.disabled = this.renderSamples.length === 0;
  }

  /**
   * Triggers download of the current diagnostics artifact as JSON.
   */
  private exportPerfArtifact(): void {
    if (!this.showPerfDiagnostics || this.renderSamples.length === 0) {
      return;
    }

    // Save the report as JSON so developers can compare runs or attach it to bug reports.
    const artifact = this.buildPerfArtifact();
    const artifactBlob = new Blob([JSON.stringify(artifact, null, 2)], {
      type: 'application/json',
    });
    const downloadUrl = URL.createObjectURL(artifactBlob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    link.href = downloadUrl;
    link.download = `cdg-perf-${timestamp}.json`;
    link.click();

    URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Recomputes and renders the small on-screen diagnostics HUD.
   */
  private updatePerfHud(): void {
    if (!this.perfElement) {
      return;
    }

    if (this.renderSamples.length === 0) {
      this.perfElement.textContent =
        'Speed check: play a song to collect samples...';
      return;
    }

    const latest = this.renderSamples[this.renderSamples.length - 1];
    if (!latest) {
      this.perfElement.textContent =
        'Speed check: play a song to collect samples...';
      return;
    }

    // Show a simple live dashboard:
    // - avg ms: normal frame cost (lower is better)
    // - p95 ms: "bad day" frame cost (spike indicator)
    // - avg bytes: average data moved per frame
    const modeSamples = this.renderSamples.filter(
      (sample) => sample.mode === latest.mode,
    );

    const sortedCpu = modeSamples
      .map((sample) => sample.frameCpuMs)
      .sort((a, b) => a - b);
    const p95Index = Math.min(
      sortedCpu.length - 1,
      Math.floor(sortedCpu.length * 0.95),
    );
    const avgCpuMs =
      modeSamples.reduce((sum, sample) => sum + sample.frameCpuMs, 0) /
      modeSamples.length;
    const avgTransferredBytes =
      modeSamples.reduce((sum, sample) => sum + sample.transferredBytes, 0) /
      modeSamples.length;

    // We report only the current mode in HUD so beginners are not juggling two data sets at once.
    // The exported JSON still includes both modes for mentors/advanced debugging.
    this.perfElement.textContent =
      `Speed check (${latest.mode})\n` +
      `avg ${avgCpuMs.toFixed(2)} ms | p95 ${(sortedCpu[p95Index] ?? 0).toFixed(2)} ms\n` +
      `avg bytes ${Math.round(avgTransferredBytes)}`;
  }
}
