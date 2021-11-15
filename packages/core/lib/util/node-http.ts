// @denoify-ignore
import type { ServerResponse } from "http";
import type { Http2ServerResponse } from "http2";
import { isAsyncIterable } from "./is-async-iterable";

export type NodeResponse = ServerResponse | Http2ServerResponse;

export async function sendNodeResponse(responseResult: Response, nodeResponse: NodeResponse): Promise<void> {
  const headersObj: any = {};
  responseResult.headers.forEach((value, name) => {
    headersObj[name] = headersObj[name] || [];
    headersObj[name].push(value);
  });
  nodeResponse.writeHead(responseResult.status, headersObj);
  const responseBody: ReadableStream | null = await responseResult.body;
  if (responseBody == null) {
    throw new Error("Response body is not supported");
  }
  if (responseBody instanceof Uint8Array) {
    (nodeResponse as any).write(responseBody);
    nodeResponse.end();
  } else if (isAsyncIterable(responseBody)) {
    for await (const chunk of responseBody) {
      if (chunk) {
        (nodeResponse as any).write(chunk);
      }
    }
    nodeResponse.end();
  } else if ('getReader' in responseBody) {
    const reader = responseBody.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        (nodeResponse as any).write(value);
      }
      if (done) {
        nodeResponse.end();
        break;
      }
    }
    nodeResponse.on('close', () => {
      reader.releaseLock();
    })
  } else {
    throw new Error(`Unrecognized Response type provided`);
  }
}
