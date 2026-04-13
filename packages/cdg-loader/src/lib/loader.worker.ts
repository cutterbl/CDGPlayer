/**
 * Worker runtime that executes load/probe requests off the main thread.
 */
import { LoaderError } from './errors.js';
import { createLoader } from './loader-core.js';
import type {
  LoadedTrack,
  LoaderErrorContext,
  LoaderInput,
  LoaderOptions,
  LoaderProbeResult,
} from './types.js';

const debugLog = (...args: unknown[]): void => {
  console.log('[cdg-loader-worker]', ...args);
};

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
}: {
  type: ErrorResponseMessage['type'];
  requestId: string;
  errorValue: unknown;
}): void => {
  debugLog('postError', { type, requestId, errorValue });
  if (errorValue instanceof LoaderError) {
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
    debugLog('message', {
      type: message.type,
      requestId: 'requestId' in message ? message.requestId : null,
    });

    if (message.type === 'cancel') {
      debugLog('cancel', { requestId: message.requestId });
      loader.cancel({ requestId: message.requestId });
      return;
    }

    if (message.type === 'dispose') {
      debugLog('dispose');
      loader.dispose();
      workerScope.close();
      return;
    }

    if (message.type === 'probe') {
      try {
        debugLog('probe:start', {
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
        debugLog('probe:success', {
          requestId: message.requestId,
          karaokeLikely: result.karaokeLikely,
        });
      } catch (errorValue: unknown) {
        postError({
          type: 'probe-result',
          requestId: message.requestId,
          errorValue,
        });
      }

      return;
    }

    if (message.type === 'load') {
      try {
        debugLog('load:start', {
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
        debugLog('load:success', {
          requestId: message.requestId,
          trackId: result.trackId,
          sourceSummary: result.sourceSummary,
        });
      } catch (errorValue: unknown) {
        postError({
          type: 'load-result',
          requestId: message.requestId,
          errorValue,
        });
      }
    }
  },
);
