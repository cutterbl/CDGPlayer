/**
 * Worker runtime that executes load/probe requests off the main thread.
 */
import { createScopedLogger } from '@cxing/logger';
import { LoaderError } from './errors.js';
import { createLoader } from './loader-core.js';
import type {
  LoadedTrack,
  LoaderErrorContext,
  LoaderInput,
  LoaderOptions,
  LoaderProbeResult,
} from './types.js';

/** Worker-side options mirror without AbortSignal (handled by message protocol). */
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

type DisposeRequestMessage = {
  type: 'dispose';
};

type WorkerRequestMessage =
  | LoadRequestMessage
  | ProbeRequestMessage
  | CancelRequestMessage
  | DisposeRequestMessage;

type SuccessResponseMessage =
  | {
      type: 'load-result';
      requestId: string;
      ok: true;
      result: LoadedTrack;
    }
  | {
      type: 'probe-result';
      requestId: string;
      ok: true;
      result: LoaderProbeResult;
    };

type ErrorResponseMessage = {
  type: 'load-result' | 'probe-result';
  requestId: string;
  ok: false;
  error: {
    code: string;
    message: string;
    retriable: boolean;
    context: LoaderErrorContext;
  };
};

type WorkerResponseMessage = SuccessResponseMessage | ErrorResponseMessage;

type WorkerScope = {
  addEventListener: (
    type: 'message',
    listener: (
      event: MessageEvent<WorkerRequestMessage>,
    ) => void | Promise<void>,
  ) => void;
  postMessage: (
    message: WorkerResponseMessage,
    options?: { transfer?: Transferable[] },
  ) => void;
  close: () => void;
};

const workerScope = self as unknown as WorkerScope;
const loader = createLoader();

const createWorkerLogger = ({ debug }: { debug: boolean }) =>
  createScopedLogger({ scope: 'cdg-loader-worker', debug });

const createTransferables = ({
  result,
}: {
  result: LoadedTrack;
}): Transferable[] => {
  const transfers: Transferable[] = [result.audioBuffer];
  if (result.cdgBytes.buffer instanceof ArrayBuffer) {
    transfers.push(result.cdgBytes.buffer);
  }
  return transfers;
};

const postError = ({
  type,
  requestId,
  errorValue,
  debug,
}: {
  type: ErrorResponseMessage['type'];
  requestId: string;
  errorValue: unknown;
  debug: boolean;
}): void => {
  const logger = createWorkerLogger({ debug });
  logger.debug({ message: 'postError', type, requestId, errorValue });
  if (errorValue instanceof LoaderError) {
    logger.error({
      message: 'postError:loader-error',
      type,
      requestId,
      code: errorValue.code,
      loaderMessage: errorValue.message,
      retriable: errorValue.retriable,
      context: errorValue.context,
    });

    const errorResponse: ErrorResponseMessage = {
      type,
      requestId,
      ok: false,
      error: {
        code: errorValue.code,
        message: errorValue.message,
        retriable: errorValue.retriable,
        context: errorValue.context,
      },
    };
    workerScope.postMessage(errorResponse satisfies WorkerResponseMessage);
    return;
  }

  const fallbackError = new LoaderError({
    code: 'INTERNAL',
    message: 'Unexpected worker failure.',
    retriable: false,
    causeValue: errorValue,
  });
  logger.error({
    message: 'postError:unexpected',
    type,
    requestId,
    code: fallbackError.code,
    loaderMessage: fallbackError.message,
    retriable: fallbackError.retriable,
    context: fallbackError.context,
  });

  const errorResponse: ErrorResponseMessage = {
    type,
    requestId,
    ok: false,
    error: {
      code: fallbackError.code,
      message: fallbackError.message,
      retriable: fallbackError.retriable,
      context: fallbackError.context,
    },
  };

  workerScope.postMessage(errorResponse satisfies WorkerResponseMessage);
};

workerScope.addEventListener(
  'message',
  async (event: MessageEvent<WorkerRequestMessage>) => {
    const message = event.data;
    const debugEnabled =
      (message.type === 'probe' || message.type === 'load') &&
      message.options?.debug === true;
    const logger = createWorkerLogger({ debug: debugEnabled });

    logger.debug({
      message: 'message',
      type: message.type,
      requestId: 'requestId' in message ? message.requestId : null,
    });

    if (message.type === 'cancel') {
      logger.debug({ message: 'cancel', requestId: message.requestId });
      loader.cancel({ requestId: message.requestId });
      return;
    }

    if (message.type === 'dispose') {
      logger.debug({ message: 'dispose' });
      loader.dispose();
      workerScope.close();
      return;
    }

    if (message.type === 'probe') {
      try {
        logger.debug({
          message: 'probe:start',
          requestId: message.requestId,
          inputKind: message.input.kind,
        });
        const result = await loader.probe({
          input: message.input,
          ...(message.options ? { options: message.options } : {}),
        });

        const successResponse: SuccessResponseMessage = {
          type: 'probe-result',
          requestId: message.requestId,
          ok: true,
          result,
        };

        workerScope.postMessage(
          successResponse satisfies WorkerResponseMessage,
        );
        logger.debug({
          message: 'probe:success',
          requestId: message.requestId,
          karaokeLikely: result.karaokeLikely,
        });
      } catch (errorValue: unknown) {
        postError({
          type: 'probe-result',
          requestId: message.requestId,
          errorValue,
          debug: debugEnabled,
        });
      }

      return;
    }

    if (message.type === 'load') {
      try {
        logger.debug({
          message: 'load:start',
          requestId: message.requestId,
          inputKind: message.input.kind,
        });
        const result = await loader.load({
          input: message.input,
          ...(message.options ? { options: message.options } : {}),
        });

        const successResponse: SuccessResponseMessage = {
          type: 'load-result',
          requestId: message.requestId,
          ok: true,
          result,
        };

        workerScope.postMessage(
          successResponse satisfies WorkerResponseMessage,
          {
            transfer: createTransferables({ result }),
          },
        );
        logger.debug({
          message: 'load:success',
          requestId: message.requestId,
          trackId: result.trackId,
          sourceSummary: result.sourceSummary,
        });
      } catch (errorValue: unknown) {
        postError({
          type: 'load-result',
          requestId: message.requestId,
          errorValue,
          debug: debugEnabled,
        });
      }
    }
  },
);
