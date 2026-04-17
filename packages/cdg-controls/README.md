# @cxing/cdg-controls

Framework-agnostic controls model plus DOM control builders for CDG playback UX.

Use this package when you want reusable controls that can be mounted directly in DOM or driven from framework components.

## Install

```bash
pnpm add @cxing/cdg-controls
```

## Model-First Usage

```ts
import {
  createControlsModel,
  createPlayPauseControl,
  createProgressControl,
  createVolumeControl,
  createTempoControl,
  createKeyControl,
} from '@cxing/cdg-controls';

const model = createControlsModel({ options: { player } });

createPlayPauseControl({ container: transportEl, model });
createProgressControl({ container: transportEl, model });

createVolumeControl({
  container: settingsEl,
  model,
  orientation: 'vertical',
});
createTempoControl({
  container: settingsEl,
  model,
  orientation: 'vertical',
});
createKeyControl({ container: settingsEl, model });
```

## Convenience API

```ts
import { createControls } from '@cxing/cdg-controls';

const controls = createControls({
  options: {
    container,
    player,
  },
});

// later
controls.dispose();
```

## Adapter Contract Highlights

Your player adapter must provide:

- `getState`, `play`, `pause`, `stop`, `seek`
- `setVolume`, `setPlaybackRate`, `setPitchSemitones`
- optional `setTempo`
- `statechange` events

## Key Label Semantics

- UI `Key` slider datalist labels are displayed as singer-facing half-step values.
- Model writes remain integer semitone values through `setPitchSemitones({ value })`.

## Docs

- Controls contract: https://cutterscrossing.com/?path=/docs/documentation-api-controls-contract--docs
- Framework-agnostic guide: https://cutterscrossing.com/storybook-web/?path=/docs/examples-framework-agnostic-demo-implementation-guide--docs
- React guide: https://cutterscrossing.com/storybook-react/?path=/docs/examples-react-demo-implementation-guide--docs
