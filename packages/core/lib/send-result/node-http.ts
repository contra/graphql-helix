// @denoify-ignore
import type { ServerResponse } from "http";
import type { Http2ServerResponse } from "http2";
import { HttpError } from "../errors";
import type { Response, MultipartResponse, Push, ProcessRequestResult } from "../types";
import { calculateByteLength } from "../util/calculate-byte-length";
import { TransformResultFn, DEFAULT_TRANSFORM_RESULT_FN } from "./utils";

export type RawResponse = ServerResponse | Http2ServerResponse;

export async function sendResponseResult(
  responseResult: Response<any, any>,
  rawResponse: RawResponse,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): Promise<void> {
  for (const { name, value } of responseResult.headers) {
    rawResponse.setHeader(name, value);
  }
  const data = JSON.stringify(transformResult(responseResult.payload));
  rawResponse.writeHead(responseResult.status, {
    "content-type": "application/json",
    "content-length": calculateByteLength(data),
  });
  rawResponse.end(data);
}

export async function sendMultipartResponseResult(
  multipartResult: MultipartResponse<any, any>,
  rawResponse: RawResponse,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): Promise<void> {
  /**
   * TypeScript complains because of function call signature mismatches.
   * The signatures, however, are identical, thus we cas this here to suppress warnings,
   */
  const response: ServerResponse = rawResponse as ServerResponse;
  response.writeHead(200, {
    // prettier-ignore
    "Connection": "keep-alive",
    "Content-Type": 'multipart/mixed; boundary="-"',
    "Transfer-Encoding": "chunked",
  });

  response.on("close", () => {
    multipartResult.unsubscribe();
  });
  response.write("---");

  await multipartResult.subscribe((result) => {
    const chunk = JSON.stringify(transformResult(result));
    const data = [
      "",
      "Content-Type: application/json; charset=utf-8",
      "Content-Length: " + calculateByteLength(chunk),
      "",
      chunk,
    ];

    if (result.hasNext) {
      data.push("---");
    }
    response.write(data.join("\r\n"));
  });

  response.write("\r\n-----\r\n");
  response.end();
}

export async function sendPushResult(
  pushResult: Push<any, any>,
  rawResponse: RawResponse,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): Promise<void> {
  /**
   * TypeScript complains because of function call signature mismatches.
   * The signatures, however, are identical, thus we cas this here to suppress warnings,
   */
  const response: ServerResponse = rawResponse as ServerResponse;
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    // prettier-ignore
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
  });

  response.on("close", () => {
    pushResult.unsubscribe();
  });

  await pushResult.subscribe((result) => {
    response.write(`data: ${JSON.stringify(transformResult(result))}\n\n`);
  });
  response.end();
}

export async function sendResult(
  result: ProcessRequestResult<any, any>,
  rawResponse: RawResponse,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): Promise<void> {
  switch (result.type) {
    case "RESPONSE":
      return sendResponseResult(result, rawResponse, transformResult);
    case "MULTIPART_RESPONSE":
      return sendMultipartResponseResult(result, rawResponse, transformResult);
    case "PUSH":
      return sendPushResult(result, rawResponse, transformResult);
    default:
      throw new HttpError(500, "Cannot process result.");
  }
}
