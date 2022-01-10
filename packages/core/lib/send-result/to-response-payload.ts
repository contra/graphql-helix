import { ProcessRequestResult, HttpError } from "..";
import { asyncGeneratorOf } from "../util/async-generator-of";
import { calculateByteLength } from "../util/calculate-byte-length";
import { asyncIterableMap } from "../util/async-iterable-map";
import { asyncIterableChain } from "../util/async-interable-chain";

type ResponsePayload = {
  headers: {
    [name: string]: string;
  };
  source: AsyncGenerator<string>;
};

export function toResponsePayload(result: ProcessRequestResult<any, any>): ResponsePayload {
  switch (result.type) {
    case "RESPONSE": {
      const data = JSON.stringify(result.payload);
      return {
        headers: {
          ...Object.fromEntries(result.headers.map(({ name, value }) => [name, value])),
          "content-type": "application/json",
          "content-length": String(calculateByteLength(data)),
        },
        source: asyncGeneratorOf(data),
      };
    }
    case "MULTIPART_RESPONSE": {
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
            const chunk = JSON.stringify(value);
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
      };
    }
    case "PUSH": {
      return {
        headers: {
          "Content-Type": "text/event-stream",
          // prettier-ignore
          "Connection": "keep-alive",
          "Cache-Control": "no-cache",
        },
        source: asyncIterableMap(result, (value) => `data: ${JSON.stringify(value)}\n\n`),
      };
    }
    default:
      throw new HttpError(500, "Cannot process result.");
  }
}
