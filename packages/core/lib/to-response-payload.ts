import { ProcessRequestResult, Response, Push, MultipartResponse } from "./types";
import { HttpError } from "./errors";
import { asyncGeneratorOf } from "./util/async-generator-of";
import { calculateByteLength } from "./util/calculate-byte-length";
import { asyncIterableMap } from "./util/async-iterable-map";
import { asyncIterableChain } from "./util/async-iterable-chain";
import { TransformResultFn, DEFAULT_TRANSFORM_RESULT_FN } from "./transform-result";
import { asyncIterableFinalValueFromError } from "./util/async-iterable-final-value-from-error";
import { GraphQLError } from "graphql";

export type ResponsePayload = {
  headers: {
    [name: string]: string;
  };
  source: AsyncGenerator<string, void>;
  status: number;
};

export function toResponseResponsePayload(
  result: Response<any, any>,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): ResponsePayload {
  const data = JSON.stringify(transformResult(result.payload));
  return {
    headers: {
      ...Object.fromEntries(result.headers.map(({ name, value }) => [name, value])),
      "content-type": "application/json",
      "content-length": String(calculateByteLength(data)),
    },
    source: asyncGeneratorOf(data),
    status: result.status,
  };
}

export function toMultiPartResponsePayload(
  result: MultipartResponse<any, any>,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): ResponsePayload {
  return {
    headers: {
      // prettier-ignore
      "Connection": "keep-alive",
      "Content-Type": 'multipart/mixed; boundary="-"',
      "Transfer-Encoding": "chunked",
    },
    source: asyncIterableChain(
      asyncGeneratorOf("---"),
      asyncIterableMap(result, (value) => {
        const chunk = JSON.stringify(transformResult(value));
        const data = [
          "",
          "Content-Type: application/json; charset=utf-8",
          "Content-Length: " + calculateByteLength(chunk),
          "",
          chunk,
        ];
        if (value.hasNext) {
          data.push("---");
        }
        return data.join("\r\n");
      }),
      asyncGeneratorOf("\r\n-----\r\n")
    ),
    status: 200,
  };
}

export function toPushResponsePayload(
  result: Push<any, any>,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): ResponsePayload {
  return {
    headers: {
      "Content-Type": "text/event-stream",
      // prettier-ignore
      "Connection": "keep-alive",
      "Cache-Control": "no-cache",
    },
    source: asyncIterableFinalValueFromError(
      asyncIterableMap(result, (value) => `data: ${JSON.stringify(transformResult(value))}\n\n`),
      (err) =>
        `data: ` +
        JSON.stringify(
          transformResult({
            errors: [new GraphQLError((err as any)?.message ?? String(err))],
          })
        ) +
        `\n\n`
    ),
    status: 200,
  };
}

/**
 * Transforms the a `ProcessRequestResult` into a text stream published via an AsyncGenerator that can be piped into any HTTP framework.
 */
export function toResponsePayload(
  result: ProcessRequestResult<any, any>,
  transformResult: TransformResultFn = DEFAULT_TRANSFORM_RESULT_FN
): ResponsePayload {
  switch (result.type) {
    case "RESPONSE":
      return toResponseResponsePayload(result, transformResult);
    case "MULTIPART_RESPONSE":
      return toMultiPartResponsePayload(result, transformResult);
    case "PUSH":
      return toPushResponsePayload(result, transformResult);
    default:
      throw new HttpError(500, "Cannot process result.");
  }
}
