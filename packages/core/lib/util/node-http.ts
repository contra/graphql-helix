// @denoify-ignore
import type { IncomingMessage, ServerResponse } from "http";
import type { Http2ServerResponse } from "http2";
import { Request, ReadableStream } from "cross-undici-fetch";
import { isAsyncIterable } from "./is-async-iterable";

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

export async function getNodeRequest(nodeRequest: NodeRequest): Promise<Request> {
  const fullUrl = `${nodeRequest.protocol || "http"}://${nodeRequest.hostname || nodeRequest.headers.host || "localhost"}${
    nodeRequest.url || "/graphql"
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
        get: () =>
          new Request(fullUrl, {
            method: "POST",
            body: JSON.stringify(maybeParsedBody),
          }).body,
      },
    });
    return request;
  } else if (isAsyncIterable(rawRequest)) {
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of rawRequest) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (e) {
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
  const serverResponse = nodeResponse as ServerResponse;
  responseResult.headers.forEach((value, name) => {
    serverResponse.setHeader(name, value);
  });
  serverResponse.statusCode = responseResult.status;
  serverResponse.statusMessage = responseResult.statusText;
  const responseBody = await (responseResult.body as unknown as Promise<ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | null>);
  if (responseBody != null) {
    if (responseBody instanceof Uint8Array) {
      serverResponse.write(responseBody);
    } else if (isAsyncIterable(responseBody)) {
      for await (const chunk of responseBody) {
        if (chunk) {
          serverResponse.write(chunk);
        }
      }
      nodeResponse.end();
    } else if (typeof responseBody.getReader === "function") {
      const reader = responseBody.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          serverResponse.write(value);
        }
        if (done) {
          nodeResponse.end();
          break;
        }
      }
      nodeResponse.on("close", () => {
        reader.releaseLock();
      });
    }
  }
  serverResponse.end();
}
