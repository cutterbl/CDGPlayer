import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseFrameworkDemoContext } = vi.hoisted(() => ({
  mockUseFrameworkDemoContext: vi.fn(),
}));

vi.mock('./hooks/useFrameworkDemo.context', () => ({
  default: mockUseFrameworkDemoContext,
}));

import useFilePickerRowProps from './components/FilePickerRow/hooks/useFilePickerRowProps.memo';
import useSettingsPanelProps from './components/SettingsPanel/hooks/useSettingsPanelProps.memo';
import useTransportBarProps from './components/TransportBar/hooks/useTransportBarProps.memo';

const createContextValue = (overrides: Record<string, unknown> = {}) => ({
  player: null,
  controlsModel: null,
  setTitleMetadata: vi.fn(),
  setHasGraphicsTrack: vi.fn(),
  setHasVideoTrack: vi.fn(),
  codecDiagnostic: null,
  setCodecDiagnostic: vi.fn(),
  showPerfDiagnostics: false,
  perfSummary: null,
  showStatusMessage: vi.fn(),
  resetPlaybackStarted: vi.fn(),
  exportPerfArtifact: vi.fn(),
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
  ...overrides,
});

describe('Framework demo hook edge cases', () => {
  beforeEach(() => {
    mockUseFrameworkDemoContext.mockReset();
  });

  it('ignores invalid settings values before forwarding to the controls model', () => {
    const controlsModel = {
      setVolume: vi.fn(),
      setTempo: vi.fn(),
      setPitchSemitones: vi.fn(),
    };

    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        controlsModel,
        viewState: {
          status: 'ready',
          trackId: 'track',
          currentTimeMs: 0,
          durationMs: 120_000,
          volume: 0.5,
          playbackRate: 1,
          pitchSemitones: 0,
          isPlayable: true,
          isPlaying: false,
          progressPercent: 0,
        },
      }),
    );

    const { result } = renderHook(() => useSettingsPanelProps());

    result.current.handleSetVolume({
      target: { value: 'not-a-number' },
    } as never);
    result.current.handleSetTempo({
      target: { value: 'not-a-number' },
    } as never);
    result.current.handleSetPitchSemitones({
      target: { value: 'still-not-a-number' },
    } as never);

    expect(controlsModel.setVolume).not.toHaveBeenCalled();
    expect(controlsModel.setTempo).not.toHaveBeenCalled();
    expect(controlsModel.setPitchSemitones).not.toHaveBeenCalled();
  });

  it('parses valid settings values even when no controls model is available', () => {
    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        controlsModel: null,
        viewState: {
          status: 'ready',
          trackId: 'track',
          currentTimeMs: 0,
          durationMs: 120_000,
          volume: 0.5,
          playbackRate: 1,
          pitchSemitones: 0,
          isPlayable: true,
          isPlaying: false,
          progressPercent: 0,
        },
      }),
    );

    const { result } = renderHook(() => useSettingsPanelProps());

    expect(() => {
      result.current.handleSetVolume({
        target: { value: '0.75' },
      } as never);
      result.current.handleSetTempo({
        target: { value: '1.25' },
      } as never);
      result.current.handleSetPitchSemitones({
        target: { value: '-4' },
      } as never);
    }).not.toThrow();
  });

  it('ignores transport actions when the model is missing or seek input is invalid', () => {
    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        controlsModel: null,
        viewState: {
          status: 'ready',
          trackId: 'track',
          currentTimeMs: 15_000,
          durationMs: 60_000,
          volume: 1,
          playbackRate: 1,
          pitchSemitones: 0,
          isPlayable: true,
          isPlaying: false,
          progressPercent: 25,
        },
      }),
    );

    const { result: noModelResult } = renderHook(() => useTransportBarProps());
    noModelResult.current.handleTogglePlayPause();

    const controlsModel = {
      togglePlayPause: vi.fn(async () => undefined),
      seekPercent: vi.fn(),
    };
    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        controlsModel,
        viewState: {
          status: 'ready',
          trackId: 'track',
          currentTimeMs: 15_000,
          durationMs: 60_000,
          volume: 1,
          playbackRate: 1,
          pitchSemitones: 0,
          isPlayable: true,
          isPlaying: false,
          progressPercent: 25,
        },
      }),
    );

    const { result } = renderHook(() => useTransportBarProps());
    result.current.handleSeekPercent({
      target: { value: 'invalid' },
    } as never);

    expect(controlsModel.togglePlayPause).not.toHaveBeenCalled();
    expect(controlsModel.seekPercent).not.toHaveBeenCalled();
  });

  it('parses valid seek input even when the controls model is missing', () => {
    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        controlsModel: null,
        viewState: {
          status: 'ready',
          trackId: 'track',
          currentTimeMs: 15_000,
          durationMs: 60_000,
          volume: 1,
          playbackRate: 1,
          pitchSemitones: 0,
          isPlayable: true,
          isPlaying: false,
          progressPercent: 25,
        },
      }),
    );

    const { result } = renderHook(() => useTransportBarProps());

    expect(() => {
      result.current.handleSeekPercent({
        target: { value: '42.5' },
      } as never);
    }).not.toThrow();
  });

  it('handles absent players and non-Error load failures in the file picker hook', async () => {
    const showStatusMessage = vi.fn();

    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        player: null,
        showStatusMessage,
      }),
    );

    const file = new File(['zip-content'], 'track.zip', {
      type: 'application/zip',
    });
    const { result: noPlayerResult } = renderHook(() =>
      useFilePickerRowProps(),
    );

    noPlayerResult.current.handleTrackSelect({
      target: { files: [file] },
    } as never);

    const player = {
      stop: vi.fn(),
      load: vi.fn(async () => {
        throw 'string failure';
      }),
    };
    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        player,
        setTitleMetadata: vi.fn(),
        showStatusMessage,
        resetPlaybackStarted: vi.fn(),
      }),
    );

    const { result } = renderHook(() => useFilePickerRowProps());
    result.current.handleTrackSelect({
      target: { files: [file] },
    } as never);

    await Promise.resolve();
    await Promise.resolve();

    expect(player.stop).toHaveBeenCalledOnce();
    expect(showStatusMessage).toHaveBeenCalledWith(
      'Load failed: Unknown load error',
    );
  });

  it('shows proactive codec warning when browser reports weak support for selected video mime type', async () => {
    const setCodecDiagnostic = vi.fn();
    const showStatusMessage = vi.fn();
    const player = {
      stop: vi.fn(),
      load: vi.fn(async () => ({
        mediaKind: 'video',
        hasGraphics: false,
        metadata: {
          title: 'Video',
          artist: 'Artist',
        },
      })),
    };

    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');

    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        player,
        setTitleMetadata: vi.fn(),
        setHasGraphicsTrack: vi.fn(),
        setHasVideoTrack: vi.fn(),
        setCodecDiagnostic,
        showStatusMessage,
        resetPlaybackStarted: vi.fn(),
      }),
    );

    const { result } = renderHook(() => useFilePickerRowProps());
    const videoFile = new File(['video-content'], 'sample-video.mp4', {
      type: 'video/mp4',
    });

    result.current.handleTrackSelect({
      target: { files: [videoFile] },
    } as never);

    await Promise.resolve();
    await Promise.resolve();

    expect(setCodecDiagnostic).toHaveBeenCalledWith(
      'This browser reports limited support for video/mp4. For best compatibility, use MP4 (H.264 video + AAC audio).',
    );
  });

  it('shows unsupported codec guidance when player rejects video decode in catch path', async () => {
    const setCodecDiagnostic = vi.fn();
    const showStatusMessage = vi.fn();
    const player = {
      stop: vi.fn(),
      load: vi.fn(async () => {
        throw new Error('Unable to load video media in this browser');
      }),
    };

    mockUseFrameworkDemoContext.mockReturnValue(
      createContextValue({
        player,
        setTitleMetadata: vi.fn(),
        setHasGraphicsTrack: vi.fn(),
        setHasVideoTrack: vi.fn(),
        setCodecDiagnostic,
        showStatusMessage,
        resetPlaybackStarted: vi.fn(),
      }),
    );

    const { result } = renderHook(() => useFilePickerRowProps());
    const videoFile = new File(['video-content'], 'unsupported.avi', {
      type: 'video/x-msvideo',
    });

    result.current.handleTrackSelect({
      target: { files: [videoFile] },
    } as never);

    await Promise.resolve();
    await Promise.resolve();

    expect(setCodecDiagnostic).toHaveBeenCalledWith(
      'This file appears to use an unsupported video codec for this browser (video/x-msvideo). Try MP4 with H.264 video + AAC audio.',
    );
    expect(showStatusMessage).toHaveBeenCalledWith(
      'Load failed: Unable to load video media in this browser',
    );
  });
});
