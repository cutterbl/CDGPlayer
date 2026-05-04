import { LoaderError } from './errors.js';

describe('LoaderError', () => {
  it('stores structured loader error details', () => {
    const cause = new Error('boom');
    const error = new LoaderError({
      code: 'INTERNAL',
      message: 'Unexpected loader failure.',
      retriable: false,
      context: { source: 'unit-test', details: 'fixture' },
      causeValue: cause,
    });

    expect(error.name).toBe('LoaderError');
    expect(error.code).toBe('INTERNAL');
    expect(error.message).toBe('Unexpected loader failure.');
    expect(error.retriable).toBe(false);
    expect(error.context).toEqual({ source: 'unit-test', details: 'fixture' });
    expect(error.causeValue).toBe(cause);
  });
});
