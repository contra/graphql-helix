import { Buffer } from "https://deno.land/std@0.85.0/node/buffer.ts";
import type { ServerResponse } from "http DENOIFY: DEPENDENCY UNMET (BUILTIN)";
import type { Http2ServerResponse } from "http2 DENOIFY: DEPENDENCY UNMET (BUILTIN)";
import { HttpError } from "../errors.ts";
import type { Response, MultipartResponse, Push, ProcessRequestResult } from "../types.ts";

export type RawResponse = ServerResponse | Http2ServerResponse;

export async function sendResponseResult(responseResult: Response<any, any>, rawResponse: RawResponse): Promise<void> {
  for (const { name, value } of responseResult.headers) {
    rawResponse.setHeader(name, value);
  }
  rawResponse.writeHead(responseResult.status, {
    "content-type": "application/json",
  });
  rawResponse.end(JSON.stringify(responseResult.payload));
}

export async function sendMultipartResponseResult(
  multipartResult: MultipartResponse<any, any>,
  rawResponse: RawResponse
): Promise<void> {
  rawResponse.writeHead(200, {
    // prettier-ignore
    "Connection": "keep-alive",
    "Content-Type": 'multipart/mixed; boundary="-"',
    "Transfer-Encoding": "chunked",
  });

  rawResponse.on("close", () => {
    multipartResult.unsubscribe();
  });
  // @ts-expect-error - Different Signature between ServerResponse and Http2ServerResponse but still compatible.
  rawResponse.write("---");

  await multipartResult.subscribe((result) => {
    const chunk = Buffer.from(JSON.stringify(result), "utf8");
    const data = ["", "Content-Type: application/json; charset=utf-8", "Content-Length: " + String(chunk.length), "", chunk];

    if (result.hasNext) {
      data.push("---");
    }
    // @ts-expect-error - Different Signature between ServerResponse and Http2ServerResponse but still compatible.
    rawResponse.write(data.join("\r\n"));
  });

  // @ts-expect-error - Different Signature between ServerResponse and Http2ServerResponse but still compatible.
  rawResponse.write("\r\n-----\r\n");
  rawResponse.end();
}

export async function sendPushResult(pushResult: Push<any, any>, rawResponse: RawResponse): Promise<void> {
  rawResponse.writeHead(200, {
    "Content-Type": "text/event-stream",
    // prettier-ignore
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
  });

  rawResponse.on("close", () => {
    pushResult.unsubscribe();
  });

  await pushResult.subscribe((result) => {
    // @ts-expect-error - Different Signature between ServerResponse and Http2ServerResponse but still compatible.
    rawResponse.write(`data: ${JSON.stringify(result)}\n\n`);
  });
}

export async function sendResult(result: ProcessRequestResult<any, any>, rawResponse: RawResponse): Promise<void> {
  switch (result.type) {
    case "RESPONSE":
      return sendResponseResult(result, rawResponse);
    case "MULTIPART_RESPONSE":
      return sendMultipartResponseResult(result, rawResponse);
    case "PUSH":
      return sendPushResult(result, rawResponse);
    default:
      throw new HttpError(500, "Cannot process result.");
  }
}
