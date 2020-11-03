<h1 align="center">
	<br>
	<img width="400" src="./logo.png" alt="GraphQL Helix">
	<br>
	<br>
	<br>
</h1>

> A highly evolved GraphQL HTTP Server 🧬

GraphQL Helix is a collection of utility functions for building your own GraphQL HTTP server.

## Features

- **Framework and runtime agnostic.** Use whatever HTTP library you want. GraphQL Helix works in Node, Deno and in the browser.
- **HTTP first.** GraphQL Helix allows you to create a [GraphQL over HTTP](https://github.com/graphql/graphql-over-http) specification-compliant server, while exposing a single HTTP endpoint for everything from documentation to subscriptions.
- **Server push and client pull.** GraphQL Helix supports real-time requests with both subscriptions and `@defer` and `@stream` directives.
- **Flexible.** GraphQL Helix abstracts away logic that's common to all GraphQL HTTP servers, while leaving the implementation to you. Implement the features you want and take full control of your transport layer.
- **Minimal.** No bloat. No paid platform intergration. Zero dependencies outside of `graphql-js`.

## Installation

```
npm install graphql-helix
```

## Basic Usage

The following example shows how to integrate GraphQL Helix with Node.js using Express. This example shows how to implement all the basic features, including a GraphiQL interface, subscriptions and support for `@stream` and `@defer`. See the rest of the [examples](./examples) for implementations using other frameworks and runtimes. For implementing additional features, see the [Recipes](#Recipes) section below.

```js
import express, { RequestHandler } from "express";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "../lib";
import { schema } from "./schema";

const app = express();

app.use(express.json());

app.use("/graphql", async (req, res) => {
  // Create a generic Request object that can be consumed by Graphql Helix's API
  const request = {
    body: req.body,
    headers: req.headers,
    method: req.method,
    query: req.query,
  };

  // Determine whether we should render GraphiQL instead of returning an API response
  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL());
  } else {
    // Extract the GraphQL parameters from the request
    const { operationName, query, variables } = getGraphQLParameters(request);

    // Validate and execute the query
    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    // processRequest returns one of three types of results depending on how the server should respond
    // 1) RESPONSE: a regular JSON payload
    // 2) MULTIPART RESPONSE: a multipart response (when @stream or @defer directives are used)
    // 3) PUSH: a stream of events to push back down the client for a subscription
    if (result.type === "RESPONSE") {
      // We set the provided status and headers and just the send the payload back to the client
      result.headers.forEach(({ name, value }) => res.setHeader(name, value));
      res.status(result.status);
      res.json(result.payload);
    } else if (result.type === "MULTIPART_RESPONSE") {
      // Indicate we're sending a multipart response
      res.writeHead(200, {
        Connection: "keep-alive",
        "Content-Type": 'multipart/mixed; boundary="-"',
        "Transfer-Encoding": "chunked",
      });

      // If the request is closed by the client, we unsubscribe and stop executing the request
      req.on("close", () => {
        result.unsubscribe();
      });

      // Subscribe and send back each result as a separate chunk. We await the subscribe
      // call. Once we're done executing the request and there are no more results to send
      // to the client, the Promise returned by subscribe will resolve and we can end the response.
      await result.subscribe((result) => {
        const chunk = Buffer.from(JSON.stringify(result), "utf8");
        const data = [
          "",
          "---",
          "Content-Type: application/json; charset=utf-8",
          "Content-Length: " + String(chunk.length),
          "",
          chunk,
          "",
        ].join("\r\n");
        res.write(data);
      });

      res.write("\r\n-----\r\n");
      res.end();
    } else {
      // Indicate we're sending an event stream to the client
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      });

      // If the request is closed by the client, we unsubscribe and stop executing the request
      req.on("close", () => {
        result.unsubscribe();
      });

      // We subscribe to the event stream and push any new events to the client
      await result.subscribe((result) => {
        res.write(`data: ${JSON.stringify(result)}\n\n`);
      });
    }
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
```

## API

### `getGraphQLParameters`

```ts
function getGraphQLParameters(request: Request): GraphQLParams;
```

Extracts the `query`, `variables` and `operationName` values from the request.

### `processRequest`

```ts
function processRequest(
  options: ProcessRequestOptions
): Promise<ProcessRequestResult>;
```

Takes the `schema`, `request`, `query`, `variables`, `operationName` and a number of other optional parameters and returns one of three kinds of results, depending on the sort of response the server should send back.

### `renderGraphiQL`

```ts
function renderGraphiQL(options: RenderGraphiQLOptions = {}): string;
```

Returns the HTML to render a GraphiQL instance.

### `shouldRenderGraphiQL`

```ts
function shouldRenderGraphiQL(request: Request): boolean;
```

Uses the method and headers in the request to determine whether a GraphiQL instance should be returned instead of processing an API request.

## Types

```ts
export interface GraphQLParams {
  operationName?: string;
  query?: string;
  variables?: string | { [name: string]: any };
}

export interface RenderGraphiQLOptions {
  /**
   * An optional GraphQL string to use when no query is provided and no stored
   * query exists from a previous session.  If undefined is provided, GraphiQL
   * will use its own default query.
   */
  defaultQuery?: string;
  /**
   * The endpoint requests should be sent. Defaults to `/graphql`.
   */
  graphqlEndpoint?: string;
}

export interface ProcessRequestOptions {
  /**
   * A function whose return value is passed in as the `context` to `execute`.
   */
  contextFactory?: (
    executionContext: ExecutionContext
  ) => Promise<unknown> | unknown;
  /**
   * An optional function which will be used to execute instead of default `execute` from `graphql-js`.
   */
  execute?: typeof execute;
  /**
   * The name of the Operation in the Document to execute.
   */
  operationName?: string;
  /**
   * An optional function which will be used to create a document instead of the default `parse` from `graphql-js`.
   */
  parse?: typeof parse;
  /**
   * A Document containing GraphQL Operations and Fragments to execute.
   */
  query?: string | DocumentNode;
  /**
   * An object describing the HTTP request.
   */
  request: Request;
  /**
   * A function whose return value is passed in as the `rootValue` to `execute`.
   */
  rootValueFactory?: (
    executionContext: ExecutionContext
  ) => Promise<unknown> | unknown;
  /**
   * The GraphQL schema used to process the request.
   */
  schema: GraphQLSchema;
  /**
   * An optional function which will be used to subscribe instead of default `subscribe` from `graphql-js`.
   */
  subscribe?: typeof subscribe;
  /**
   * An optional function which will be used to validate instead of default `validate` from `graphql-js`.
   */
  validate?: typeof validate;
  /**
   * An optional array of validation rules that will be applied to the document
   * in place of those defined by the GraphQL specification.
   */
  validationRules?: ReadonlyArray<ValidationRule>;
  /**
   * Values for any Variables defined by the Operation.
   */
  variables?: string | { [name: string]: any };
}

export interface ExecutionContext {
  document: DocumentNode;
  operation: OperationDefinitionNode;
  variables?: { readonly [name: string]: unknown };
}

export interface Request {
  body?: any;
  headers: Headers;
  method: string;
  query: any;
}

export type Headers =
  | Record<string, string | string[] | undefined>
  | { get(name: string): string | null };

export interface Response {
  type: "RESPONSE";
  status: number;
  headers: { name: string; value: string }[];
  payload: ExecutionResult;
}

export interface MultipartResponse {
  type: "MULTIPART_RESPONSE";
  subscribe: (onResult: (result: ExecutionResult) => void) => Promise<void>;
  unsubscribe: () => void;
}

export interface Push {
  type: "PUSH";
  subscribe: (onResult: (result: ExecutionResult) => void) => Promise<void>;
  unsubscribe: () => void;
}

export type ProcessRequestResult = Response | MultipartResponse | Push;
```

## Recipes

### Capturing and formatting responses

As you can see in the examples, GraphQL Helix leaves it up to you to send the appropriate response back to the client. While this requires a little more boilerplate, it means you're free to do whatever
you want with the execution result before it's sent to the client:

- Log the response using your [favorite logger](https://github.com/gajus/roarr).
- Format your errors and mask them in production.
- Add an `extensions` field to the response with additional metadata to send to the client

### Customizing GraphiQL

By using `shouldRenderGraphiQL`, you can expose a GraphiQL interface through the same endpoint as your API. However, you can also use the `renderGraphiQL` function to create a separate endpoint for the interface. In fact, you could use it to create a GraphiQL instance for an entirely separate server if you so chose. Not happy with the way the GraphiQL interface returned by `renderGraphiQL` looks or behaves? You can copy and paste the source code and create your own template.

### Persisted queries and request batching

While you can use `getGraphQLParameters` to extract the `query`, `variables` and `operationName` values from your request, and subsequently let `processRequest` parse the `query` for you, you don't have to. In fact, you can pass in an already parsed query (i.e. a `DocumentNode` object) as the `query` when calling `processRequest`, in which case the "parse" step will be skipped altogether.

What's the advantage of this? For one, you can let your clients provide a query ID instead of the query itself. The clients could pass this ID in as a `queryId` search parameter in the the URL, for example. The queries themselves could be mapped to the IDs and stored in-memory, already parsed. This not only means a smaller payload for the client, but also a faster execution time for each request since the same query doesn't have to be parsed repeatedly. Once you've got the pre-parsed query, you can pass it to `processRequest` like normal. Voilà -- persisted queries!

You can implement request batching in a similar fashion. In request batching, the client to send multiple GraphQL requests through a single call to the server. If the request body is an array instead of an object, you can just call `processRequest` for each item in the array.

### File uploads

Follow the instructions [here](https://github.com/jaydenseric/graphql-upload) for adding the Upload scalar to your schema and the appropriate middleware to your server.

### @defer and @stream

The examples used in this repo are compatible with the [fetch-multipart-graphql](https://github.com/relay-tools/fetch-multipart-graphql) library.

### Subscriptions over SSE

A complementary client library is in progress. In the meantime, you can check out the `fetcher` implementation inside `renderGraphiQL` to see how to easily implement SSE subscriptions on the client side.
