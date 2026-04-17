import {
  createScopedLogger,
  error,
  info,
  log,
  warn,
  warning,
} from './logger.js';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('base severity helpers', () => {
    it('log emits message only when no payload values are provided', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);

      log({ message: 'hello' });

      expect(consoleLogSpy).toHaveBeenCalledWith('hello');
    });

    it('log forwards payload values and drops undefined entries', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);

      log({
        message: 'hello',
        first: 'one',
        second: undefined,
        third: { ok: true },
      });

      expect(consoleLogSpy).toHaveBeenCalledWith('hello', 'one', { ok: true });
    });

    it('info emits to console.info', () => {
      const consoleInfoSpy = vi
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);

      info({ message: 'ready', value: 42 });

      expect(consoleInfoSpy).toHaveBeenCalledWith('ready', 42);
    });

    it('warn emits to console.warn', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      warn({ message: 'watch out', value: 'payload' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('watch out', 'payload');
    });

    it('warning aliases warn', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      warning({ message: 'compat', reason: 'alias' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('compat', 'alias');
    });

    it('error emits to console.error', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      error({ message: 'boom', code: 'E_FAIL' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('boom', 'E_FAIL');
    });

    it('info emits message only when payload values are undefined', () => {
      const consoleInfoSpy = vi
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);

      info({ message: 'plain info', ignored: undefined });

      expect(consoleInfoSpy).toHaveBeenCalledWith('plain info');
    });
  });

  describe('createScopedLogger', () => {
    it('prefixes scope for direct severity methods', () => {
      const consoleInfoSpy = vi
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);
      const logger = createScopedLogger({ scope: 'demo', debug: false });

      logger.info({ message: 'statechange', state: 'ready' });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[demo]',
        'statechange',
        'ready',
      );
    });

    it('does not emit debug when debug is disabled', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const logger = createScopedLogger({ scope: 'demo', debug: false });

      logger.debug({ message: 'hidden debug', value: 1 });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('debug defaults to log severity when enabled', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const logger = createScopedLogger({ scope: 'demo', debug: true });

      logger.debug({ message: 'visible debug', value: 1 });

      expect(consoleLogSpy).toHaveBeenCalledWith('[demo]', 'visible debug', 1);
    });

    it('debug routes to requested severity when enabled', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const logger = createScopedLogger({ scope: 'demo', debug: true });

      logger.debug({ severity: 'warn', message: 'warn debug', value: 2 });

      expect(consoleWarnSpy).toHaveBeenCalledWith('[demo]', 'warn debug', 2);
    });

    it('debug falls back to log for non-severity values', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const logger = createScopedLogger({ scope: 'demo', debug: true });
      const invalidSeverity = 'bogus' as unknown as
        | 'log'
        | 'info'
        | 'warn'
        | 'error';

      logger.debug({ severity: invalidSeverity, message: 'fallback' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[demo]', 'fallback');
    });

    it('scoped warning and error map to warn/error channels', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const logger = createScopedLogger({ scope: 'demo', debug: true });

      logger.warning({ message: 'legacy warning' });
      logger.error({ message: 'fatal' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('[demo]', 'legacy warning');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[demo]', 'fatal');
    });
  });
});
