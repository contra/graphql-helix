// @denoify-ignore
import type { ServerResponse } from "http";
import type { Http2ServerResponse } from "http2";
import { HttpError } from "../errors";
import type { Response, MultipartResponse, Push, ProcessRequestResult } from "../types";
import { TransformResultFn, DEFAULT_TRANSFORM_RESULT_FN } from "../transform-result";
import { toResponseResponsePayload, toMultiPartResponsePayload, toPushResponsePayload } from "../to-response-payload";

export type RawResponse = ServerResponse | Http2ServerResponse;

/** @deprecated */
export async function sendResponseResult(
  responseResult: Response<any, any>,
  rawResponse: RawResponse,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): Promise<void> {
  /**
   * TypeScript complains because of function call signature mismatches.
   * The signatures, however, are identical, thus we cas this here to suppress warnings,
   */
  const response: ServerResponse = rawResponse as ServerResponse;
  const responsePayload = toResponseResponsePayload(responseResult, transformResult);
  for (const [name, value] of Object.entries(responsePayload.headers)) {
    response.setHeader(name, value);
  }
  response.statusCode = responsePayload.status;
  response.on("close", () => {
    responsePayload.source.return();
  });
  for await (const value of responsePayload.source) {
    response.write(value);
  }

  response.end();
}

/** @deprecated */
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
  const responsePayload = toMultiPartResponsePayload(multipartResult, transformResult);
  for (const [name, value] of Object.entries(responsePayload.headers)) {
    response.setHeader(name, value);
  }
  response.statusCode = responsePayload.status;
  response.on("close", () => {
    responsePayload.source.return();
  });
  for await (const value of responsePayload.source) {
    response.write(value);
  }
  response.end();
}

/** @deprecated */
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
  const responsePayload = toPushResponsePayload(pushResult, transformResult);
  for (const [name, value] of Object.entries(responsePayload.headers)) {
    response.setHeader(name, value);
  }
  response.statusCode = responsePayload.status;
  response.on("close", () => {
    responsePayload.source.return();
  });
  for await (const value of responsePayload.source) {
    response.write(value);
  }
  response.end();
}

/** @deprecated */
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
