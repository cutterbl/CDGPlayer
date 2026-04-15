import { describe, expect, it, vi } from 'vitest';
import { AppElement } from './app.element';

const TEST_TAG_NAME = 'app-element-helpers-test';

const createAppElement = () => {
  if (!customElements.get(TEST_TAG_NAME)) {
    customElements.define(TEST_TAG_NAME, AppElement);
  }

  return document.createElement(TEST_TAG_NAME) as AppElement;
};

describe('AppElement helpers', () => {
  it('handles diagnostics helper guard branches and export logic', () => {
    const app = createAppElement() as AppElement & {
      createModeSummary: (samples: unknown[]) => unknown;
      syncPerfExportButton: () => void;
      exportPerfArtifact: () => void;
      updatePerfHud: () => void;
      perfElement: HTMLElement | null;
      perfExportButton: HTMLButtonElement | null;
      renderSamples: Array<{
        mode: 'main-thread' | 'worker';
        frameCpuMs: number;
        transferredBytes: number;
        atMs: number;
      }>;
      showPerfDiagnostics: boolean;
    };

    expect(app.createModeSummary([])).toBeNull();

    app.syncPerfExportButton();
    app.updatePerfHud();

    const perfElement = document.createElement('div');
    const exportButton = document.createElement('button');
    app.perfElement = perfElement;
    app.perfExportButton = exportButton;
    app.renderSamples = [];

    app.updatePerfHud();
    app.syncPerfExportButton();

    expect(perfElement.textContent).toBe(
      'Speed check: play a song to collect samples...',
    );
    expect(exportButton.disabled).toBe(true);

    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:perf-report');
    const revokeObjectUrlSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    app.exportPerfArtifact();
    expect(createObjectUrlSpy).not.toHaveBeenCalled();

    Object.defineProperty(app, 'showPerfDiagnostics', {
      configurable: true,
      value: true,
    });
    app.renderSamples = [
      {
        mode: 'main-thread',
        frameCpuMs: 3.5,
        transferredBytes: 2048,
        atMs: 16,
      },
      {
        mode: 'worker',
        frameCpuMs: 5.25,
        transferredBytes: 1024,
        atMs: 33,
      },
      {
        mode: 'worker',
        frameCpuMs: 4.5,
        transferredBytes: 1536,
        atMs: 50,
      },
    ];

    app.syncPerfExportButton();
    app.updatePerfHud();
    app.exportPerfArtifact();

    expect(exportButton.disabled).toBe(false);
    expect(perfElement.textContent).toContain('Speed check (worker)');
    expect(createObjectUrlSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectUrlSpy).toHaveBeenCalledOnce();
  });

  it('covers render-metric guard branches, overflow trimming, and sparse perf snapshots', () => {
    const app = createAppElement() as AppElement & {
      recordRenderMetrics: (
        detail: {
          mode: 'main-thread' | 'worker';
          frameCpuMs: number;
          transferredBytes: number;
          atMs: number;
        } | null,
      ) => void;
      updatePerfHud: () => void;
      createModeSummary: (
        samples: Array<{
          mode: 'main-thread' | 'worker';
          frameCpuMs: number;
          transferredBytes: number;
          atMs: number;
        }>,
      ) => unknown;
      perfElement: HTMLElement | null;
      renderSamples: Array<{
        mode: 'main-thread' | 'worker';
        frameCpuMs: number;
        transferredBytes: number;
        atMs: number;
      }>;
      showPerfDiagnostics: boolean;
    };

    Object.defineProperty(app, 'showPerfDiagnostics', {
      configurable: true,
      value: true,
    });
    app.perfElement = document.createElement('div');
    app.renderSamples = [];

    app.recordRenderMetrics(null);
    expect(app.renderSamples).toEqual([]);

    app.renderSamples = Array.from({ length: 120 }, (_, index) => ({
      mode: index % 2 === 0 ? 'main-thread' : 'worker',
      frameCpuMs: index + 1,
      transferredBytes: 100 + index,
      atMs: index,
    }));

    app.recordRenderMetrics({
      mode: 'worker',
      frameCpuMs: 4.75,
      transferredBytes: 2048,
      atMs: 999,
    });

    expect(app.renderSamples).toHaveLength(120);
    expect(app.renderSamples.at(-1)?.atMs).toBe(999);

    app.renderSamples = [
      {
        mode: 'worker',
        frameCpuMs: 5.25,
        transferredBytes: 1024,
        atMs: 33,
      },
      {
        mode: 'worker',
        frameCpuMs: 4.5,
        transferredBytes: 1536,
        atMs: 50,
      },
    ];
    expect(app.createModeSummary(app.renderSamples)).toBeTruthy();
    app.updatePerfHud();
    expect(app.perfElement.textContent).toContain('Speed check (worker)');

    app.renderSamples = [undefined as never];
    app.updatePerfHud();
    expect(app.perfElement.textContent).toBe(
      'Speed check: play a song to collect samples...',
    );
  });

  it('handles title/status/layout helper guards and fallback branches', () => {
    const app = createAppElement() as AppElement & {
      clearStatusFadeTimeout: () => void;
      setStatusMessage: (message: string) => void;
      setTitleMetadata: (
        metadata: { title: string; artist: string } | null,
      ) => void;
      syncTitleImage: (status: string) => void;
      syncLayout: (status: string) => void;
      statusElement: HTMLElement | null;
      titleImage: HTMLElement | null;
      titleMeta: HTMLElement | null;
      titleMetaTitle: HTMLElement | null;
      titleMetaArtist: HTMLElement | null;
      appShell: HTMLElement | null;
      hasPlaybackStarted: boolean;
      statusFadeTimeoutId: number | null;
    };

    app.clearStatusFadeTimeout();
    app.setStatusMessage('Ignored');
    app.setTitleMetadata(null);
    app.syncTitleImage('idle');
    app.syncLayout('idle');

    app.statusElement = document.createElement('div');
    app.titleImage = document.createElement('div');
    app.titleMeta = document.createElement('div');
    app.titleMetaTitle = document.createElement('div');
    app.titleMetaArtist = document.createElement('div');
    app.appShell = document.createElement('div');

    app.setTitleMetadata(null);
    expect(app.titleMetaTitle.textContent).toBe('');

    app.setTitleMetadata({ title: '  ', artist: 'Artist Name' });
    expect(app.titleMetaTitle.textContent).toBe('Unknown Title');
    expect(app.titleMetaArtist.textContent).toBe('Artist Name');

    app.hasPlaybackStarted = false;
    app.syncTitleImage('ready');
    expect(app.titleImage.classList.contains('hide')).toBe(false);

    app.hasPlaybackStarted = true;
    app.syncTitleImage('paused');
    expect(app.titleImage.classList.contains('hide')).toBe(true);

    app.syncLayout('paused');
    expect(app.appShell.classList.contains('show-player')).toBe(true);
    expect(app.appShell.classList.contains('has-track')).toBe(true);

    app.syncLayout('idle');
    expect(app.appShell.classList.contains('show-player')).toBe(false);
    expect(app.appShell.classList.contains('has-track')).toBe(false);

    app.setStatusMessage('Visible status');
    expect(app.statusElement.textContent).toBe('Visible status');
    expect(app.statusElement.classList.contains('is-visible')).toBe(true);

    app.clearStatusFadeTimeout();
    expect(app.statusFadeTimeoutId).toBeNull();
  });

  it('returns early when required DOM nodes are missing during initialization', () => {
    const app = createAppElement() as AppElement & {
      initializeDemo: () => void;
    };

    expect(() => app.initializeDemo()).not.toThrow();
  });
});
