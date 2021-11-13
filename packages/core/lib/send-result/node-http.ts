// @denoify-ignore
import type { ServerResponse } from "http";
import type { Http2ServerResponse } from "http2";

export type RawResponse = ServerResponse | Http2ServerResponse;

async function* streamAsyncIterable<R = any>(stream: ReadableStream<R>): AsyncIterable<R | undefined> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function sendResponse(
  responseResult: Response,
  rawResponse: RawResponse,
) {
  const headersObj: any = {};
  responseResult.headers.forEach((value, name) => {
    headersObj[name] = value;
  });
  rawResponse.writeHead(responseResult.status, headersObj);
  const responseBody = responseResult.body;
  if (responseBody == null) {
    throw new Error("Response body is not supported");
  }
  const iterable = streamAsyncIterable(responseBody);
  for await (const chunk of iterable) {
    if (chunk) {
      // @ts-expect-error - Different Signature between ServerResponse and Http2ServerResponse but still compatible.
      rawResponse.write(chunk);
    }
  }
  rawResponse.end();
}
