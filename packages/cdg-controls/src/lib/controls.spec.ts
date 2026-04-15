import {
  createControls,
  createControlsModel,
  createCurrentTimeDisplay,
  createDurationDisplay,
  createPlayPauseControl,
  createProgressControl,
  createTempoControl,
  createVolumeControl,
  createKeyControl,
  type ControlsPlayerAdapter,
  type ControlsPlayerState,
} from './controls.js';

class MockPlayer extends EventTarget implements ControlsPlayerAdapter {
  private state: ControlsPlayerState = {
    status: 'idle',
    trackId: null,
    currentTimeMs: 0,
    durationMs: 0,
    volume: 1,
    playbackRate: 1,
    pitchSemitones: 0,
  };

  plays = 0;
  pauses = 0;
  stops = 0;
  seeks: number[] = [];
  volumes: number[] = [];
  rates: number[] = [];
  tempos: number[] = [];
  semitones: number[] = [];

  getState(): Readonly<ControlsPlayerState> {
    return this.state;
  }

  async play(): Promise<void> {
    this.plays += 1;
    this.setState({ status: 'playing' });
  }

  pause(): void {
    this.pauses += 1;
    this.setState({ status: 'paused' });
  }

  stop(): void {
    this.stops += 1;
    this.setState({ status: 'ready', currentTimeMs: 0 });
  }

  seek({ percentage }: { percentage: number }): void {
    this.seeks.push(percentage);
  }

  setVolume({ value }: { value: number }): void {
    this.volumes.push(value);
    this.setState({ volume: value });
  }

  setPlaybackRate({ value }: { value: number }): void {
    this.rates.push(value);
    this.setState({ playbackRate: value });
  }

  setTempo({ value }: { value: number }): void {
    this.tempos.push(value);
    this.setState({ playbackRate: value });
  }

  setPitchSemitones({ value }: { value: number }): void {
    this.semitones.push(value);
    this.setState({ pitchSemitones: value });
  }

  setState(nextPatch: Partial<ControlsPlayerState>): void {
    this.state = { ...this.state, ...nextPatch };
    this.dispatchEvent(new CustomEvent('statechange'));
  }
}

class MockPlayerWithoutTempo
  extends EventTarget
  implements ControlsPlayerAdapter
{
  private state: ControlsPlayerState = {
    status: 'idle',
    trackId: null,
    currentTimeMs: 0,
    durationMs: 0,
    volume: 1,
    playbackRate: 1,
    pitchSemitones: 0,
  };

  plays = 0;
  pauses = 0;
  stops = 0;
  seeks: number[] = [];
  volumes: number[] = [];
  rates: number[] = [];
  semitones: number[] = [];

  getState(): Readonly<ControlsPlayerState> {
    return this.state;
  }

  async play(): Promise<void> {
    this.plays += 1;
    this.setState({ status: 'playing' });
  }

  pause(): void {
    this.pauses += 1;
    this.setState({ status: 'paused' });
  }

  stop(): void {
    this.stops += 1;
    this.setState({ status: 'ready', currentTimeMs: 0 });
  }

  seek({ percentage }: { percentage: number }): void {
    this.seeks.push(percentage);
  }

  setVolume({ value }: { value: number }): void {
    this.volumes.push(value);
    this.setState({ volume: value });
  }

  setPlaybackRate({ value }: { value: number }): void {
    this.rates.push(value);
    this.setState({ playbackRate: value });
  }

  setPitchSemitones({ value }: { value: number }): void {
    this.semitones.push(value);
    this.setState({ pitchSemitones: value });
  }

  setState(nextPatch: Partial<ControlsPlayerState>): void {
    this.state = { ...this.state, ...nextPatch };
    this.dispatchEvent(new CustomEvent('statechange'));
  }
}

describe('controls', () => {
  it('supports distributed controls via a shared model', async () => {
    const player = new MockPlayer();
    const transportContainer = document.createElement('div');
    const settingsContainer = document.createElement('div');
    document.body.appendChild(transportContainer);
    document.body.appendChild(settingsContainer);

    const model = createControlsModel({
      options: {
        player,
      },
    });

    const parts = [
      createPlayPauseControl({ container: transportContainer, model }),
      createCurrentTimeDisplay({ container: transportContainer, model }),
      createProgressControl({ container: transportContainer, model }),
      createDurationDisplay({ container: transportContainer, model }),
      createVolumeControl({ container: settingsContainer, model }),
      createTempoControl({
        container: settingsContainer,
        model,
        orientation: 'vertical',
      }),
      createKeyControl({ container: settingsContainer, model }),
    ];

    player.setState({
      status: 'ready',
      durationMs: 240000,
      currentTimeMs: 60000,
    });

    const playButton =
      transportContainer.querySelector<HTMLButtonElement>('[data-role="play"]');
    const progress = transportContainer.querySelector<HTMLInputElement>(
      '[data-role="progress"]',
    );
    const volume = settingsContainer.querySelector<HTMLInputElement>(
      '[data-role="volume"]',
    );
    const tempo = settingsContainer.querySelector<HTMLInputElement>(
      '[data-role="playback-rate"]',
    );
    const volumeTickList = settingsContainer.querySelector<HTMLDataListElement>(
      `#${volume?.getAttribute('list') ?? ''}`,
    );
    const volumeTicks = volumeTickList?.querySelectorAll('option') ?? [];

    expect(playButton).toBeTruthy();
    expect(progress?.value).toBe('25.0');
    expect(volume?.getAttribute('list')).toBeTruthy();
    expect(tempo?.getAttribute('orient')).toBe('vertical');
    expect(tempo?.getAttribute('list')).toBeTruthy();
    expect(volumeTicks.length).toBe(11);

    playButton?.click();
    await Promise.resolve();
    expect(player.plays).toBe(1);

    progress!.value = '50';
    progress!.dispatchEvent(new Event('input'));
    expect(player.seeks.at(-1)).toBe(50);

    for (const part of parts) {
      part.dispose();
    }
    model.dispose();
    transportContainer.remove();
    settingsContainer.remove();
  });

  it('binds UI interactions to player adapter', async () => {
    const player = new MockPlayer();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const controls = createControls({
      options: {
        container,
        player,
      },
    });

    player.setState({
      status: 'ready',
      durationMs: 120000,
      currentTimeMs: 30000,
    });

    const playButton =
      container.querySelector<HTMLButtonElement>('[data-role="play"]');
    const progress = container.querySelector<HTMLInputElement>(
      '[data-role="progress"]',
    );
    const volume = container.querySelector<HTMLInputElement>(
      '[data-role="volume"]',
    );
    const playbackRate = container.querySelector<HTMLInputElement>(
      '[data-role="playback-rate"]',
    );
    const pitchSemitones = container.querySelector<HTMLSelectElement>(
      '[data-role="pitch-semitones"]',
    );

    expect(playButton).toBeTruthy();
    expect(container.querySelector('[data-role="stop"]')).toBeNull();
    expect(progress).toBeTruthy();
    expect(volume).toBeTruthy();
    expect(playbackRate).toBeTruthy();
    expect(pitchSemitones).toBeTruthy();
    expect(volume?.getAttribute('list')).toBeTruthy();
    expect(playbackRate?.getAttribute('list')).toBeTruthy();

    if (!progress || !volume || !playbackRate || !pitchSemitones) {
      throw new Error('Expected controls inputs to exist.');
    }

    expect(pitchSemitones.querySelector('option[value="1"]')?.textContent).toBe(
      '.5',
    );
    expect(pitchSemitones.querySelector('option[value="2"]')?.textContent).toBe(
      '1',
    );
    expect(
      pitchSemitones.querySelector('option[value="-1"]')?.textContent,
    ).toBe('-.5');

    playButton?.click();
    await Promise.resolve();
    expect(player.plays).toBe(1);

    progress.value = '42';
    progress.dispatchEvent(new Event('input'));
    expect(player.seeks.at(-1)).toBe(42);

    volume.value = '0.5';
    volume.dispatchEvent(new Event('input'));
    expect(player.volumes.at(-1)).toBe(0.5);

    playbackRate.value = '1.25';
    playbackRate.dispatchEvent(new Event('input'));
    expect(player.tempos.at(-1)).toBe(1.25);
    expect(player.rates).toHaveLength(0);

    pitchSemitones.value = '-3';
    pitchSemitones.dispatchEvent(new Event('change'));
    expect(player.semitones.at(-1)).toBe(-3);

    controls.dispose();
    container.remove();
  });

  it('falls back to playback-rate when tempo method is unavailable', () => {
    const player = new MockPlayerWithoutTempo();

    const container = document.createElement('div');
    document.body.appendChild(container);

    const controls = createControls({
      options: {
        container,
        player,
      },
    });

    const playbackRate = container.querySelector<HTMLInputElement>(
      '[data-role="playback-rate"]',
    );
    expect(playbackRate).toBeTruthy();

    if (!playbackRate) {
      throw new Error('Expected playback-rate input to exist.');
    }

    playbackRate.value = '1.1';
    playbackRate.dispatchEvent(new Event('input'));

    expect(player.rates.at(-1)).toBe(1.1);

    controls.dispose();
    container.remove();
  });
});
