import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseFrameworkDemoContext } = vi.hoisted(() => ({
  mockUseFrameworkDemoContext: vi.fn(),
}));

vi.mock('./hooks/useFrameworkDemo.context', () => ({
  default: mockUseFrameworkDemoContext,
}));

import FilePickerRow from './components/FilePickerRow';
import SettingsPanel from './components/SettingsPanel';
import StageDisplay from './components/StageDisplay';
import TransportBar from './components/TransportBar';

const createContextValue = (overrides: Record<string, unknown> = {}) => ({
  canvasRef: { current: null },
  audioRef: { current: null },
  showPerfDiagnostics: false,
  statusMessage: 'Choose a track to start.',
  isStatusVisible: true,
  player: null,
  controlsModel: null,
  viewState: {
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
  },
  titleMetadata: null,
  setTitleMetadata: vi.fn(),
  perfSummary: null,
  hasTrack: false,
  showTitle: false,
  showStatusMessage: vi.fn(),
  resetPlaybackStarted: vi.fn(),
  exportPerfArtifact: vi.fn(),
  ...overrides,
});

describe('Framework demo components', () => {
  beforeEach(() => {
    mockUseFrameworkDemoContext.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders idle stage and transport fallback states without perf UI', () => {
    mockUseFrameworkDemoContext.mockReturnValue(createContextValue());

    const { container } = render(
      <>
        <TransportBar />
        <StageDisplay />
        <FilePickerRow />
        <SettingsPanel />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByText(/Speed check/)).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Export speed report (.json)' }),
    ).toBeNull();
    expect(screen.getByText('Choose a track to start.')).toBeTruthy();
    expect(screen.queryByText('Track Title')).toBeNull();
    expect((screen.getByLabelText('Volume') as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('handles file selection guard branches and success without metadata', async () => {
    const showStatusMessage = vi.fn();
    const setTitleMetadata = vi.fn();
    const resetPlaybackStarted = vi.fn();
    const exportPerfArtifact = vi.fn();
    const player = {
      stop: vi.fn(),
      load: vi.fn(async () => undefined),
    };

    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        player,
        showStatusMessage,
        setTitleMetadata,
        resetPlaybackStarted,
        showPerfDiagnostics: true,
        perfSummary: {
          mode: 'worker',
          avgCpuMs: 4.2,
          p95CpuMs: 5.1,
          avgTransferredBytes: 512,
        },
        exportPerfArtifact,
      }),
    );

    render(<FilePickerRow />);

    const input = screen.getByLabelText('Select a karaoke zip (.zip)');
    fireEvent.change(input, { target: { files: [] } });
    expect(player.stop).not.toHaveBeenCalled();

    const file = new File(['zip-content'], 'track.zip', {
      type: 'application/zip',
    });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(player.stop).toHaveBeenCalledOnce();
    expect(resetPlaybackStarted).toHaveBeenCalledOnce();
    expect(setTitleMetadata).toHaveBeenCalledWith(null);
    expect(showStatusMessage).toHaveBeenCalledWith('Loading track...');
    expect(showStatusMessage).toHaveBeenCalledWith('Track loaded.');
    expect(player.load).toHaveBeenCalledWith({
      input: { kind: 'file', file },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Export speed report (.json)' }),
    );
    expect(exportPerfArtifact).toHaveBeenCalledOnce();
  });

  it('renders playing stage metadata/hud and forwards transport/settings actions', () => {
    const togglePlayPause = vi.fn(async () => undefined);
    const seekPercent = vi.fn();
    const setVolume = vi.fn();
    const setTempo = vi.fn();
    const setPitchSemitones = vi.fn();

    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        controlsModel: {
          togglePlayPause,
          seekPercent,
          setVolume,
          setTempo,
          setPitchSemitones,
        },
        viewState: {
          status: 'playing',
          trackId: 'track-1',
          currentTimeMs: 61_000,
          durationMs: 122_000,
          volume: 0.75,
          playbackRate: 1.2,
          pitchSemitones: 3,
          isPlayable: true,
          isPlaying: true,
          progressPercent: 50.5,
        },
        titleMetadata: {
          title: 'Track Title',
          artist: 'Track Artist',
        },
        perfSummary: {
          mode: 'worker',
          avgCpuMs: 4.2,
          p95CpuMs: 5.1,
          avgTransferredBytes: 512,
        },
        showPerfDiagnostics: true,
        hasTrack: true,
        showTitle: true,
      }),
    );

    const { container } = render(
      <>
        <TransportBar />
        <StageDisplay />
        <SettingsPanel />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByText('Track Title')).toBeTruthy();
    expect(screen.getByText('Track Artist')).toBeTruthy();
    expect(screen.getByText(/Speed check \(worker\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(togglePlayPause).toHaveBeenCalledTimes(1);

    const stage = container.querySelector('canvas')?.parentElement;
    if (!stage) {
      throw new Error('Expected stage wrapper to exist.');
    }
    fireEvent.click(stage);
    expect(togglePlayPause).toHaveBeenCalledTimes(2);

    fireEvent.change(
      container.querySelector('input[type="range"][max="100"]')!,
      {
        target: { value: '25.5' },
      },
    );
    expect(seekPercent).toHaveBeenCalledWith({ percentage: 25.5 });

    fireEvent.change(screen.getByLabelText('Volume'), {
      target: { value: '0.4' },
    });
    fireEvent.change(screen.getByLabelText('Tempo'), {
      target: { value: '1.4' },
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '-2' },
    });

    expect(setVolume).toHaveBeenCalledWith({ value: 0.4 });
    expect(setTempo).toHaveBeenCalledWith({ value: 1.4 });
    expect(setPitchSemitones).toHaveBeenCalledWith({ value: -2 });
  });
});
