# @cxing/logger

Small, scope-prefixed logging utility for CXing runtime packages.

## Install

```bash
pnpm add @cxing/logger
```

## API

```ts
import { createScopedLogger } from '@cxing/logger';

const logger = createScopedLogger({
  scope: 'my-module',
  debug: false,
});

logger.log({ message: 'message' });
logger.info({ message: 'ready' });
logger.warn({ message: 'degraded path' });
logger.error({ message: 'load failed', errorValue });

logger.debug({ message: 'trace message' });
logger.debug({ severity: 'warn', message: 'debug warning' });
logger.debug({
  severity: 'error',
  message: 'load failed',
  someObj: { a: 1, b: 'foo' },
  extraContext: ['zip', 'worker'],
});
```

## Behavior

- Every scoped method emits with a `[scope]` prefix.
- `debug(...)` is the only debug-gated method.
- Required debug form: `debug({ message, severity?, ...namedData })`.
- Any key name is allowed in `namedData`; all non-`severity` values are forwarded as variadic log args (key insertion order).
- `debug({ message })` defaults to `log` severity.
- `debug({ message, severity, ...namedData })` routes through the selected severity.
- Direct `log/info/warn/error` calls are never debug-gated.
- Package guidance: use `debug(...)` for routine traces and reserve direct severity methods for must-always events.
