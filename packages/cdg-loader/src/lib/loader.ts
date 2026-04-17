import { createScopedLogger } from '@cxing/logger';
import { LoaderError } from './errors.js';
import { createLoader, type CdgLoader } from './loader-core.js';
import type {
  LoadedTrack,
  LoaderErrorCode,
  LoaderInput,
  LoaderOptions,
} from './types.js';

export { CdgLoader, createLoader };

type WorkerLoaderOptions = Omit<LoaderOptions, 'signal'>;

type LoadRequestMessage = {
  type: 'load';
  requestId: string;
  input: LoaderInput;
  options?: WorkerLoaderOptions;
};

type ProbeRequestMessage = {
  type: 'probe';
  requestId: string;
  input: LoaderInput;
  options?: WorkerLoaderOptions;
};

type CancelRequestMessage = {
  type: 'cancel';
  requestId: string;
};

type WorkerRequestMessage =
  | LoadRequestMessage
  | ProbeRequestMessage
  | CancelRequestMessage;

type LoadResultMessage =
  | {
      type: 'load-result';
      requestId: string;
      ok: true;
      result: LoadedTrack;
    }
  | {
      type: 'load-result';
      requestId: string;
      ok: false;
      error: {
        code: string;
        message: string;
        retriable: boolean;
        context: Record<string, unknown>;
      };
    };

type ProbeResultMessage =
  | {
      type: 'probe-result';
      requestId: string;
      ok: true;
      result: {
        karaokeLikely: boolean;
        discoveredEntries: readonly string[];
        hasExtraEntries: boolean;
        extensionCaseIssues: boolean;
      };
    }
  | {
      type: 'probe-result';
      requestId: string;
      ok: false;
      error: {
        code: string;
        message: string;
        retriable: boolean;
        context: Record<string, unknown>;
      };
    };

type WorkerResultMessage = LoadResultMessage | ProbeResultMessage;

type WorkerErrorResultMessage = Extract<WorkerResultMessage, { ok: false }>;

const toLoaderError = ({
  error,
}: {
  error: WorkerErrorResultMessage;
}): LoaderError =>
  new LoaderError({
    code: (error.error.code as LoaderErrorCode) ?? 'INTERNAL',
    message: error.error.message,
    retriable: error.error.retriable,
    context: error.error.context,
  });

const supportsWorkerTransport = (): boolean => typeof Worker === 'function';

const createRequestId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const toWorkerOptions = (
  options?: LoaderOptions,
): WorkerLoaderOptions | undefined => {
  if (!options) {
    return undefined;
  }

  const nextOptions: WorkerLoaderOptions = {
    ...(options.requestId ? { requestId: options.requestId } : {}),
    ...(options.strictValidation != null
      ? {
          strictValidation: options.strictValidation,
        }
      : {}),
    ...(options.debug != null
      ? {
          debug: options.debug,
        }
      : {}),
  };

  return Object.keys(nextOptions).length ? nextOptions : undefined;
};

const runWorkerRequest = async <TResult>({
  requestMessage,
  resultType,
  requestId,
  signal,
  debug,
}: {
  requestMessage: WorkerRequestMessage;
  resultType: WorkerResultMessage['type'];
  requestId: string;
  signal: AbortSignal | undefined;
  debug: boolean;
}): Promise<TResult> => {
  const logger = createScopedLogger({ scope: 'cdg-loader', debug });

  logger.debug({
    message: 'worker:spawn',
    requestId,
    resultType,
    requestType: requestMessage.type,
  });
  const worker = new Worker(new URL('./loader.worker.ts', import.meta.url), {
    type: 'module',
  });

  return new Promise<TResult>((resolve, reject) => {
    let isSettled = false;

    const cleanup = (): void => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
    };

    const settle = ({
      value,
      isError,
    }: {
      value: TResult | Error;
      isError: boolean;
    }): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cleanup();
      if (isError) {
        reject(value);
        return;
      }
      resolve(value as TResult);
    };

    const handleAbort = (): void => {
      logger.debug({ message: 'worker:abort', requestId });
      const cancelMessage: CancelRequestMessage = {
        type: 'cancel',
        requestId,
      };

      worker.postMessage(cancelMessage);

      settle({
        value: new LoaderError({
          code: 'ABORTED',
          message: 'Worker request was aborted.',
          retriable: true,
        }),
        isError: true,
      });
    };

    const handleError = (): void => {
      logger.debug({ message: 'worker:error-event', requestId });
      settle({
        value: new LoaderError({
          code: 'INTERNAL',
          message: 'Worker transport failed.',
          retriable: true,
        }),
        isError: true,
      });
    };

    const handleMessage = (event: MessageEvent<WorkerResultMessage>): void => {
      const message = event.data;
      if (message.type !== resultType || message.requestId !== requestId) {
        return;
      }

      logger.debug({
        message: 'worker:message',
        requestId,
        type: message.type,
        ok: message.ok,
      });

      if (!message.ok) {
        settle({ value: toLoaderError({ error: message }), isError: true });
        return;
      }

      settle({ value: message.result as TResult, isError: false });
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    signal?.addEventListener('abort', handleAbort, { once: true });
    logger.debug({
      message: 'worker:post',
      requestId,
      requestType: requestMessage.type,
    });
    worker.postMessage(requestMessage);
  });
};

/**
 * Loads karaoke assets through worker transport when available.
 */
export const loadInWorker = async ({
  input,
  options,
}: {
  input: LoaderInput;
  options?: LoaderOptions;
}): Promise<LoadedTrack> => {
  const debugEnabled = options?.debug ?? false;
  const logger = createScopedLogger({
    scope: 'cdg-loader',
    debug: debugEnabled,
  });

  logger.debug({ message: 'loadInWorker:start', inputKind: input.kind });
  if (!supportsWorkerTransport()) {
    logger.debug({ message: 'loadInWorker:fallback-no-worker-support' });
    return createLoader({ debug: debugEnabled }).load({
      input,
      ...(options ? { options } : {}),
    });
  }

  if (options?.signal?.aborted) {
    logger.debug({ message: 'loadInWorker:aborted-before-dispatch' });
    throw new LoaderError({
      code: 'ABORTED',
      message: 'Load was aborted before dispatch.',
      retriable: true,
    });
  }

  const requestId = options?.requestId ?? createRequestId();
  const workerOptions = toWorkerOptions(options);

  const requestMessage: LoadRequestMessage = {
    type: 'load',
    requestId,
    input,
    ...(workerOptions ? { options: workerOptions } : {}),
  };

  logger.debug({ message: 'loadInWorker:dispatch', requestId });

  return runWorkerRequest<LoadedTrack>({
    requestMessage,
    resultType: 'load-result',
    requestId,
    signal: options?.signal,
    debug: debugEnabled,
  });
};

/**
 * Probes archive content through worker transport when available.
 */
export const probeInWorker = async ({
  input,
  options,
}: {
  input: LoaderInput;
  options?: LoaderOptions;
}): Promise<{
  karaokeLikely: boolean;
  discoveredEntries: readonly string[];
  hasExtraEntries: boolean;
  extensionCaseIssues: boolean;
}> => {
  const debugEnabled = options?.debug ?? false;
  const logger = createScopedLogger({
    scope: 'cdg-loader',
    debug: debugEnabled,
  });

  logger.debug({ message: 'probeInWorker:start', inputKind: input.kind });
  if (!supportsWorkerTransport()) {
    return createLoader({ debug: debugEnabled }).probe({
      input,
      ...(options ? { options } : {}),
    });
  }

  if (options?.signal?.aborted) {
    throw new LoaderError({
      code: 'ABORTED',
      message: 'Probe was aborted before dispatch.',
      retriable: true,
    });
  }

  const requestId = options?.requestId ?? createRequestId();
  const workerOptions = toWorkerOptions(options);

  const requestMessage: ProbeRequestMessage = {
    type: 'probe',
    requestId,
    input,
    ...(workerOptions ? { options: workerOptions } : {}),
  };

  return runWorkerRequest<{
    karaokeLikely: boolean;
    discoveredEntries: readonly string[];
    hasExtraEntries: boolean;
    extensionCaseIssues: boolean;
  }>({
    requestMessage,
    resultType: 'probe-result',
    requestId,
    signal: options?.signal,
    debug: debugEnabled,
  });
};
