<h1 align="center">
	<br>
	<img width="400" src="./logo.svg" alt="GraphQL Helix">
	<br>
	<br>
	<br>
</h1>

> A highly evolved GraphQL HTTP Server 🧬

GraphQL Helix is a collection of utility functions for building your own GraphQL HTTP server. You can check out [Building a GraphQL server with GraphQL Helix](https://dev.to/danielrearden/building-a-graphql-server-with-graphql-helix-2k44) on DEV for a detailed tutorial on getting started.

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

The following example shows how to integrate GraphQL Helix with Node.js using Express. This example shows how to implement all the basic features, including a GraphiQL interface, subscriptions and support for `@stream` and `@defer`. See the rest of the [examples](https://github.com/contra/graphql-helix/tree/master/examples) for implementations using other frameworks and runtimes. For implementing additional features, see the [Recipes](#Recipes) section below.

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

      res.write("---");

      // Subscribe and send back each result as a separate chunk. We await the subscribe
      // call. Once we're done executing the request and there are no more results to send
      // to the client, the Promise returned by subscribe will resolve and we can end the response.
      await result.subscribe((result) => {
        const chunk = Buffer.from(JSON.stringify(result), "utf8");
        const data = [
          "",
          "Content-Type: application/json; charset=utf-8",
          "Content-Length: " + String(chunk.length),
          "",
          chunk,
        ];

        if (result.hasNext) {
          data.push("---");
        }

        res.write(data.join("\r\n"));
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
function processRequest<TContext, TRootValue>(
  options: ProcessRequestOptions<TContext, TRootValue>
): Promise<ProcessRequestResult<TContext, TRootValue>>;
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
   * Whether to open the variable editor by default. Defaults to `true`.
   */
  defaultVariableEditorOpen?: boolean;
  /**
   * The endpoint requests should be sent. Defaults to `"/graphql"`.
   */
  endpoint?: string;
  /**
   * The initial headers to render inside the header editor. Defaults to `"{}"`.
   */
  headers?: string;
  /**
   * Whether the header editor is enabled. Defaults to `true`.
   */
  headerEditorEnabled?: boolean;
  /**
   * A cryptographic nonce for use with Content-Security-Policy.
   */
  nonce?: string;
  /**
   * The endpoint subscription requests should be sent to. Defaults to the value of the `endpoint` parameter.
   */
  subscriptionsEndpoint?: string;
}

export interface ProcessRequestOptions<TContext, TRootValue> {
  /**
   * A function whose return value is passed in as the `context` to `execute`.
   */
  contextFactory?: (
    executionContext: ExecutionContext
  ) => Promise<TContext> | TContext;
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
  ) => Promise<TRootValue> | TRootValue;
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

export interface Response<TContext, TRootValue> {
  type: "RESPONSE";
  status: number;
  headers: { name: string; value: string }[];
  payload: ExecutionResult;
  context?: TContext;
  rootValue?: TRootValue;
  document?: DocumentNode;
  operation?: OperationDefinitionNode;
}

export interface MultipartResponse<TContext, TRootValue> {
  type: "MULTIPART_RESPONSE";
  subscribe: (onResult: (result: ExecutionResult) => void) => Promise<void>;
  unsubscribe: () => void;
  context?: TContext;
  rootValue?: TRootValue;
  document?: DocumentNode;
  operation?: OperationDefinitionNode;
}

export interface Push<TContext, TRootValue> {
  type: "PUSH";
  subscribe: (onResult: (result: ExecutionResult) => void) => Promise<void>;
  unsubscribe: () => void;
  context?: TContext;
  rootValue?: TRootValue;
  document?: DocumentNode;
  operation?: OperationDefinitionNode;
}

export type ProcessRequestResult<TContext, TRootValue> =
  | Response<TContext, TRootValue>
  | MultipartResponse<TContext, TRootValue>
  | Push<TContext, TRootValue>;
```

## Recipes

<details>
<summary>Formatting and logging responses</summary>
</br>
GraphQL Helix leaves it up to you to send the appropriate response back to the client. While this requires a little more boilerplate, it means you're free to do whatever
you want with the execution result before it's sent to the client:

- Log the response using your [favorite logger](https://github.com/gajus/roarr).
- Format your errors and mask them in production.
- Add an `extensions` field to the response with additional metadata to send to the client

See [here](examples/error-handling) for a basic example of error handling.

</details>

<details>
<summary>Authentication and authorization</summary>
</br>
When calling `processRequest`, you can provide a `contextFactory` that will be called to generate the execution context that is passed to your resolvers. You can pass whatever values to the context that are available in the scope where `contextFactory` is called. For example, if we're using Express, we could pass in the entire `req` object:

```ts
app.use("/graphql", async (req, res) => {
  ...

  const result = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
    contextFactory: () => ({
      req,
    }),
  });
}
```

The `contextFactory` can be asyncronous and return a Promise. The function is called with a single parameter, an object with the following properties:

```ts
export interface ExecutionContext {
  document: DocumentNode;
  operation: OperationDefinitionNode;
  variables?: { readonly [name: string]: unknown };
}
```

GraphQL Helix provides this information to `contextFactory` in case you want to modify the context based on the operation that will be executed.

With `contextFactory`, we have a mechanism for doing authentication and authorization inside our application. We can determine who is accessing our API and capture that information inside the context. Our resolvers can then use the context to determine _whether_ a particular field can be resolved and how to resolve it. Check out [this example](examples/context) for basic `contextFactory` usage. If you're looking for a robust _authorization_ solution, I highly recommend [GraphQL Shield](https://github.com/maticzav/graphql-shield).

</details>

<details>
<summary>Subscriptions over SSE</summary>
</br>
GraphQL Helix is transport-agnostic and could be used with any network protocol. However, it was designed with HTTP in mind, which makes Server Sent Events (SSE) a good fit for implementing subscriptions. You can read more about the advantages and caveats of using SSE [here](https://wundergraph.com/blog/deprecate_graphql_subscriptions_over_websockets).

When the operation being executed is a subscription, `processRequest` will return a `PUSH` result, which you can then use to return a `text/event-stream` response. Here's what a basic implementation looks like:

```ts
if (result.type === "PUSH") {
  // Indicate that we're sending a stream of events and should keep the connection open.
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });

  // If the client closes the connection, we unsubscribe to prevent memory leaks.
  req.on("close", () => {
    result.unsubscribe();
  });

  // We subscribe to any new events and push them down to the client that initiated the subscription.
  await result.subscribe((result) => {
    res.write(`data: ${JSON.stringify(result)}\n\n`);
  });
}
```

On the client-side, we use the EventSource API to listen to these events. Our EventSource instance _should_ reconnect in the event the connection is closed, but this behavior varies widely from browser to browser. Therefore, it's a good idea to implement a keep-alive mechanism in production to ensure your connection stays persistent. Check out [this StackOverflow post](https://stackoverflow.com/a/20060461/6024220) for additional details. On the back end, you can just use `setInterval` to periodically send the keep alive message to the client (just make sure to clear the timer when you `unsubscribe`).

Implementing SSE on the client-side is equally simple, but you can use [sse-z](https://github.com/contrawork/sse-z) to make it even easier. If you're adding keep-alive to your implementation, `sse-z` provides a nice abstraction for that as well.

</details>

<details>
<summary>Subscriptions over WebSocket</summary>
</br>

If SSE is not your cup of tea and you want to use WebSocket as the transport for your subscriptions instead, you can still do that. For example, we can use both GraphQL Helix and [graphql-ws](https://github.com/enisdenjo/graphql-ws)

```ts
import express from "express";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { execute, subscribe } from "graphql";
import { createServer } from "graphql-ws";
import { schema } from "./schema";

const app = express();

app.use(express.json());

app.use("/graphql", async (req, res) => {
  // handle the request using processRequest as shown before
});

const port = process.env.PORT || 4000;

const server = app.listen(port, () => {
  createServer(
    {
      schema,
      execute,
      subscribe,
    },
    {
      server,
      path: "/graphql",
    }
  );

  console.log(`GraphQL server is running on port ${port}.`);
});
```

A complete example can be found [here](examples/graphql-ws). If you'd prefer you use socket.io, take a look at [socket-io-graphql-server](https://github.com/n1ru4l/graphql-live-query/tree/main/packages/socket-io-graphql-server) instead.

</details>

<details>
<summary>File uploads</summary>
</br>
File uploads, like serving static content, are generally best handled outside of your GraphQL schema. However, if you want to add support for uploads to your server, you can use the [graphql-upload](https://github.com/jaydenseric/graphql-upload) package. You need to add the Upload scalar to your schema and then add the appropriate middleware to your server.

See [here](examples/file-upload) for an example.

</details>

<details>
<summary>Using the `@defer` and `@stream` directives</summary>
</br>
GraphQL Helix supports `@defer` and `@stream` directives out-of-the-box, provided you use the appropriate version of `graphql-js`. When either directive is used, `processRequest` will return a `MULTIPART_RESPONSE` result, which you can then use to return a `multipart/mixed` response.

```ts
if (result.type === "MULTIPART_RESPONSE") {
  // Indicate that this is a multipart response and the connection should be kept open.
  res.writeHead(200, {
    Connection: "keep-alive",
    "Content-Type": 'multipart/mixed; boundary="-"',
    "Transfer-Encoding": "chunked",
  });

  // If the client closes the connection, we unsubscribe to prevent memory leaks.
  req.on("close", () => {
    result.unsubscribe();
  });

  res.write("---");

  // Subscribe to new results. The callback will be called with the
  // ExecutionResult object that should be sent back to the client for each chunk.
  await result.subscribe((result) => {
    const chunk = Buffer.from(JSON.stringify(formatResult(result)), "utf8");
    const data = [
      "Content-Type: application/json; charset=utf-8",
      "Content-Length: " + String(chunk.length),
      "",
      chunk,
    ];

    if (result.hasNext) {
      data.push("---");
    }

    res.write(data.join("\r\n"));
  });

  // The Promise returned by `subscribe` will only resolve once all chunks have been emitted,
  // at which point we can end the request.
  res.write("\r\n-----\r\n");
  res.end();
}
```

See the [here](examples/express) for a complete example.

The examples used in this repo are compatible with client-side libraries like [meros](https://github.com/maraisr/meros) and [fetch-multipart-graphql](https://github.com/relay-tools/fetch-multipart-graphql).

</details>

<details>
<summary>Using the `@live` directive</summary>
</br>
Live queries using the `@live` directive provide an alternative to subscriptions for handling real-time updates. You can add support for live queries to your server by following the instructions [here](https://github.com/n1ru4l/graphql-live-queries).

With GraphQL Helix, it's as simple as adding the directive to your schema and utilizing the alternative `execute` function provided by [@n1ru4l/in-memory-live-query-store](https://github.com/n1ru4l/graphql-live-queries/tree/main/packages/in-memory-live-query-store).

```ts
import { InMemoryLiveQueryStore } from "@n1ru4l/in-memory-live-query-store";

const liveQueryStore = new InMemoryLiveQueryStore();

...

const result = await processRequest({
  operationName,
  query,
  variables,
  request,
  schema,
  contextFactory: () => ({
    liveQueryStore,
  }),
  execute: liveQueryStore.execute,
});
```

You can checkout the complete example [here](examples/live-queries).

</details>

<details>
<summary>Persisted queries</summary>
</br>
Persisted queries are useful because they reduce the payload sent from client to server and can also be used to only allow specific queries. Persisted queries are also a performance optimization since they allow us to skip parsing the query when executing a request.

The `query` value that's passed to `processQuery` can be an already-parsed DocumentNode object instead of a string. This lets us fetch the query from memory based on some other value, like a `queryId` parameter. A rudimentary implementation could be as simple as this:

```ts
let queryId: string;
let operationName: string | undefined;
let variables: any;

if (req.method === "POST") {
  queryId = req.body.queryId;
  operationName = req.body.operationName;
  variables = req.body.variables;
} else {
  queryId = req.query.queryId as string;
  operationName = req.query.operationName as string;
  variables = req.query.variables;
}

const query = queryMap[queryId];

if (!query) {
  res.status(400);
  res.json({
    errors: [
      new GraphQLError(
        `Could not find a persisted query with an id of ${queryId}`
      ),
    ],
  });
  return;
}

const result = await processRequest({
  operationName,
  query,
  variables,
  request,
  schema,
});
```

See [here](examples/persisted-queries) for a more complete example. A more robust solution can be implemented using a library like [relay-compiler-plus](https://github.com/yusinto/relay-compiler-plus).

</details>

<details>
<summary>Performance optimization</summary>
</br>
GraphQL Helix allows you to provide your own `parse`, `validate`, `execute` and `subscribe` functions in place of the default ones provided by `graphql-js`. This makes it possible to utilize libraries like [GraphQL JIT](https://github.com/zalando-incubator/graphql-jit) by providing an appropriate `validate` function:

```ts
const result = await processRequest({
  // ...
  execute: (
    schema,
    documentAst,
    rootValue,
    contextValue,
    variableValues,
    operationName
  ) => {
    const compiledQuery = compileQuery(schema, documentAst, operationName);

    if (isCompiledQuery(compiledQuery)) {
      return compiledQuery.query(rootValue, contextValue, variableValues || {});
    }

    return compiledQuery;
  },
});
```

> ⚠️ GraphQL JIT is an experimental library that is still lacking some features required by the GraphQL specification. You probably should not use it in production unless you know what you're getting yourself into.

The ability to provide custom implementations of `parse` and `validate` means we can also optimize the performance of those individual steps by introducing caching. This allows us to bypass these steps for queries we've processed before.

For example, we can create a simple in-memory cache

```ts
import lru from "tiny-lru";

const cache = lru(1000, 3600000);
```

and then use it to cache our parsed queries so we can skip that step for subsequent requests:

```ts
import { parse } from "graphql";

const result = await processRequest({
  operationName,
  query,
  variables,
  request,
  schema,
  parse: (source, options) => {
    if (!cache.get(query)) {
      cache.set(query, parse(source, options));
    }

    return cache.get(query);
  },
});
```

We can take a similar approach with `validate` and even cache the result of `compileQuery` if we're using GraphQL JIT. See [this example](examples/graphql-jit) for a more complete implementation.

</details>
