import { ExecutionResult } from "graphql";
import { ExecutionPatchResult } from "../types";
import { calculateByteLength } from "./calculate-byte-length";
import { ReadableStream, Response } from "cross-undici-fetch";

export type TransformResultFn = (result: ExecutionResult | ExecutionPatchResult) => any;
export const DEFAULT_TRANSFORM_RESULT_FN: TransformResultFn = (result: ExecutionResult) => result;

export function getRegularResponse(executionResult: ExecutionResult, transformResult = DEFAULT_TRANSFORM_RESULT_FN): Response {
  const transformedResult = transformResult(executionResult);
  const responseBody = JSON.stringify(transformedResult);
  const contentLength = calculateByteLength(responseBody);
  const headersInit: HeadersInit = {
    "Content-Type": 'application/json',
    "Content-Length": contentLength.toString()
  };
  const responseInit: ResponseInit = {
    headers: headersInit,
    status: 200,
  };
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
        const iterator = asyncExecutionResult[Symbol.asyncIterator]();
        while (true) {
          const { done, value } = await iterator.next();
          if (done) {
            controller.enqueue("\r\n-----\r\n");
            controller.close();
            break;
          }
          const transformedResult = transformResult(value);
          const chunk = JSON.stringify(transformedResult);
          const contentLength = calculateByteLength(chunk);
          const data = [
            "",
            "Content-Type: application/json; charset=utf-8",
            "Content-Length: " + contentLength.toString(),
            "",
            chunk,
          ];
          if (value.hasNext) {
            data.push("---");
          }
          controller.enqueue(data.join("\r\n"));
        }
      } catch (e) {
        controller.error(e);
      }
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
        const iterator = asyncExecutionResult[Symbol.asyncIterator]();
        while (true) {
          const { done, value } = await iterator.next();
          if (done) {
            controller.close();
            break;
          }
          const transformedResult = transformResult(value);
          const chunk = JSON.stringify(transformedResult);
          controller.enqueue(`data: ${chunk}\n\n`);
        }
      } catch (e) {
        controller.error(e);
      }
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
    return getPushResponse(getSingleResult(payload), transformResult);
  }
  return new Response(JSON.stringify(transformResult(payload)), {
    status,
    headers,
  });
}
