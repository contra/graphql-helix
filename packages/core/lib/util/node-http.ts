// @denoify-ignore
import type { IncomingMessage, ServerResponse } from "http";
import type { Http2ServerResponse } from "http2";
import { Request, ReadableStream } from "cross-undici-fetch";

interface NodeRequest {
  protocol?: string;
  hostname?: string;
  body?: any;
  url?: string;
  method?: string;
  headers: any;
  req?: IncomingMessage;
  raw?: IncomingMessage;
}

function isIterableOrAsyncIterable<T>(obj: any): obj is Iterable<T> | AsyncIterable<T> {
  if (obj == null || typeof obj !== 'object') {
    return false;
  }
  return typeof obj[Symbol.asyncIterator] === "function" || typeof obj[Symbol.iterator] === "function";
}

export async function getNodeRequest(nodeRequest: NodeRequest): Promise<Request> {
  const fullUrl = `${nodeRequest.protocol || "http"}://${nodeRequest.hostname || nodeRequest.headers.host || "localhost"}${
    nodeRequest.url || '/graphql'
  }`;
  const maybeParsedBody = nodeRequest.body;
  const rawRequest = nodeRequest.raw || nodeRequest.req || nodeRequest;
  if (nodeRequest.method !== "POST") {
    return new Request(fullUrl, {
      headers: nodeRequest.headers,
      method: nodeRequest.method,
    });
  } else if (maybeParsedBody) {
    const request = new Request(fullUrl, {
      headers: nodeRequest.headers,
      method: nodeRequest.method,
    });
    Object.defineProperties(request, {
      json: {
        value: async () => maybeParsedBody,
      },
      text: {
        value: async () => JSON.stringify(maybeParsedBody),
      },
      body: {
        get: () => new Request(fullUrl, {
          method: 'POST',
          body: JSON.stringify(maybeParsedBody),
        }).body,
      }
    });
    return request;
  } else if (isIterableOrAsyncIterable(rawRequest)) {
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of rawRequest) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch(e) {
          controller.error(e);
        }
      },
    });
    return new Request(fullUrl, {
      headers: nodeRequest.headers,
      method: nodeRequest.method,
      body,
    });
  }
  throw new Error(`Unknown request`);
}

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
  if (isIterableOrAsyncIterable(responseBody)) {
    for await (const chunk of responseBody) {
      if (chunk) {
        (nodeResponse as any).write(chunk);
      }
    }
    nodeResponse.end();
  } else if (typeof responseBody.getReader === 'function') {
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
    nodeResponse.on("close", () => {
      reader.releaseLock();
    });
  } else {
    throw new Error(`Unrecognized Response type provided`);
  }
}
