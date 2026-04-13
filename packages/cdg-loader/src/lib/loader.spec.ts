import { createLoader, loadInWorker, probeInWorker } from './loader.js';

describe('createLoader', () => {
  it('creates a loader instance with expected API', () => {
    const value = createLoader();

    expect(typeof value.load).toBe('function');
    expect(typeof value.probe).toBe('function');
    expect(typeof value.cancel).toBe('function');
    expect(typeof value.dispose).toBe('function');
    expect(typeof loadInWorker).toBe('function');
    expect(typeof probeInWorker).toBe('function');
  });
});
