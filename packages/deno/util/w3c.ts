import { ExecutionResult } from "https://cdn.skypack.dev/graphql@16.0.0-experimental-stream-defer.5?dts";
import { stopAsyncIteration } from "./stop-async-iteration.ts";
import { ExecutionPatchResult } from "../types.ts";

export type TransformResultFn = (result: ExecutionResult | ExecutionPatchResult) => any;
export const DEFAULT_TRANSFORM_RESULT_FN: TransformResultFn = (result: ExecutionResult) => result;

export function getRegularResponse<TResponse extends Response>({
  executionResult,
  Response,
  transformResult = DEFAULT_TRANSFORM_RESULT_FN,
}: {
  executionResult: ExecutionResult;
  Response: { new (body: BodyInit, responseInit: ResponseInit): TResponse };
  transformResult?: TransformResultFn;
}): TResponse {
  const headersInit: HeadersInit = [];
  const responseInit: ResponseInit = {
    headers: headersInit,
    status: 200,
  };
  const transformedResult = transformResult(executionResult);
  const responseBody = JSON.stringify(transformedResult);
  return new Response(responseBody, responseInit);
}

export function getMultipartResponse<TResponse extends Response, TReadableStream extends ReadableStream>({
  asyncExecutionResult,
  Response,
  ReadableStream,
  transformResult = DEFAULT_TRANSFORM_RESULT_FN,
}: {
  asyncExecutionResult: AsyncIterable<ExecutionPatchResult<any>>;
  Response: { new (readableStream: TReadableStream, responseInit: ResponseInit): TResponse };
  ReadableStream: { new (underlyingSource: UnderlyingSource): TReadableStream };
  transformResult?: TransformResultFn;
}): TResponse {
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
    cancel() {
      stopAsyncIteration(asyncExecutionResult);
    },
  });
  return new Response(readableStream, responseInit);
}

export function getPushResponse<TResponse extends Response, TReadableStream extends ReadableStream>({
  asyncExecutionResult,
  Response,
  ReadableStream,
  transformResult = DEFAULT_TRANSFORM_RESULT_FN,
}: {
  asyncExecutionResult: AsyncIterable<ExecutionResult<any>>;
  Response: { new (readableStream: TReadableStream, responseInit: ResponseInit): TResponse };
  ReadableStream: { new (underlyingSource: UnderlyingSource): TReadableStream };
  transformResult?: TransformResultFn;
}): TResponse {
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
    cancel() {
      stopAsyncIteration(asyncExecutionResult);
    },
  });
  return new Response(readableStream, responseInit);
}

interface ErrorResponseParams<TResponse extends Response> {
  message: string;
  status?: number;
  headers?: any;
  errors?: { message: string }[] | readonly { message: string }[];
  transformResult?: typeof DEFAULT_TRANSFORM_RESULT_FN;
  Response: { new (body: BodyInit, responseInit: ResponseInit): TResponse };
}

export function getErrorResponse<TResponse extends Response>({
  message,
  status = 500,
  headers = {},
  errors = [{ message }],
  transformResult = DEFAULT_TRANSFORM_RESULT_FN,
}: ErrorResponseParams<TResponse>): Response {
  const payload: any = {
    errors,
  };
  return new Response(JSON.stringify(transformResult(payload)), {
    status,
    headers,
  });
}
