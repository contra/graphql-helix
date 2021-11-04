// @denoify-ignore
import type { ServerResponse } from "http";
import type { Http2ServerResponse } from "http2";
import { Readable } from "stream";

export type RawResponse = ServerResponse | Http2ServerResponse;

export function sendResponse(
  responseResult: Response,
  rawResponse: RawResponse,
): void {
  responseResult.headers.forEach((value, name) => {
    rawResponse.setHeader(name, value);
  })
  rawResponse.writeHead(responseResult.status, {
    "content-type": "application/json",
  });
  const readable: Readable = (Readable as any).fromWeb(responseResult.body);
  readable.pipe(rawResponse);
}
