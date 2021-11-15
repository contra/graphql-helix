import { ExecutionResult } from "graphql";
import { stopAsyncIteration } from "./stop-async-iteration";
import { ExecutionPatchResult } from "../types";
import { ReadableStream, Response } from "cross-undici-fetch";

export type TransformResultFn = (result: ExecutionResult | ExecutionPatchResult) => any;
export const DEFAULT_TRANSFORM_RESULT_FN: TransformResultFn = (result: ExecutionResult) => result;

export function getRegularResponse(executionResult: ExecutionResult, transformResult = DEFAULT_TRANSFORM_RESULT_FN): Response {
  const headersInit: HeadersInit = [];
  const responseInit: ResponseInit = {
    headers: headersInit,
    status: 200,
  };
  const transformedResult = transformResult(executionResult);
  const responseBody = JSON.stringify(transformedResult);
  return new Response(responseBody, responseInit);
}

export function getMultipartResponse(
  asyncExecutionResult: AsyncIterable<ExecutionPatchResult<any>>,
  transformResult = DEFAULT_TRANSFORM_RESULT_FN
): Response {
  const headersInit: HeadersInit = {
    Connection: "keep-alive",
    "Content-Type": 'multipart/mixed; boundary="-"',
    "Transfer-Encoding": "chunked",
  };
  const responseInit: ResponseInit = {
    headers: headersInit,
    status: 200,
  };
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(`---`);
        for await (const patchResult of asyncExecutionResult) {
          const transformedResult = transformResult(patchResult);
          const chunk = JSON.stringify(transformResult(transformedResult));
          const data = [
            "",
            "Content-Type: application/json; charset=utf-8",
            "Content-Length: " + String(chunk.length),
            "",
            chunk,
          ];
          if (patchResult.hasNext) {
            data.push("---");
          }
          controller.enqueue(data.join("\r\n"));
        }
        stopAsyncIteration(asyncExecutionResult);
        controller.enqueue("\r\n-----\r\n");
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel(controller) {
      stopAsyncIteration(asyncExecutionResult);
      controller.close();
    },
  });
  return new Response(readableStream, responseInit);
}

export function getPushResponse(
  asyncExecutionResult: AsyncIterable<ExecutionResult<any>>,
  transformResult = DEFAULT_TRANSFORM_RESULT_FN
): Response {
  const headersInit: HeadersInit = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  };
  const responseInit: ResponseInit = {
    headers: headersInit,
    status: 200,
  };

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const result of asyncExecutionResult) {
          controller.enqueue(`data: ${JSON.stringify(transformResult(result))}\n\n`);
        }
        stopAsyncIteration(asyncExecutionResult);
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel(controller) {
      stopAsyncIteration(asyncExecutionResult);
      controller.close();
    },
  });
  return new Response(readableStream, responseInit);
}

interface ErrorResponseParams {
  message: string;
  status?: number;
  headers?: any;
  errors?: { message: string }[] | readonly { message: string }[];
  transformResult?: typeof DEFAULT_TRANSFORM_RESULT_FN;
  isEventStream: boolean;
}

async function* getSingleResult(payload: any) {
  yield payload;
}

export function getErrorResponse({
  message,
  status = 500,
  headers = {},
  errors = [{ message }],
  transformResult = DEFAULT_TRANSFORM_RESULT_FN,
  isEventStream,
}: ErrorResponseParams): Response {
  const payload: any = {
    errors,
  };
  if (isEventStream) {
    const asyncExecutionResult = {
      next() {
        return {
          value: payload,
          done: true,
        };
      },
      [Symbol.asyncIterator]() {
        return asyncExecutionResult;
      },
    };
    return getPushResponse(getSingleResult(payload), transformResult);
  }
  return new Response(JSON.stringify(transformResult(payload)), {
    status,
    headers,
  });
}
