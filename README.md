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
- **Minimal.** No bloat. No paid platform integration. Zero dependencies outside of `graphql-js`.

## Installation

```
npm install graphql-helix
```

```
yarn add graphql-helix
```

## Basic Usage

The following example shows how to integrate GraphQL Helix with Node.js using Express. This example shows how to implement all the basic features, including a GraphiQL interface, subscriptions and support for `@stream` and `@defer`. See the rest of the [examples](./examples) for implementations using other frameworks and runtimes. For implementing additional features, see the [Recipes](#Recipes) section below.

```js
import express, { RequestHandler } from "express";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL, sendResult } from "graphql-helix";
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
    // Extract the Graphql parameters from the request
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
    // The "sendResult" is a NodeJS-only shortcut for handling all possible types of Graphql responses,
    // See "Advanced Usage" below for more details and customizations available on that layer.
    sendResult(result, res);
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
```

## Transports Variations

The `processRequest` will return one of the following types:

- `RESPONSE`: a regular JSON payload
- `MULTIPART_RESPONSE`: a multipart response (when @stream or @defer directives are used)
- `PUSH`: a stream of events to push back down the client for a GraphQL subscription

If you GraphQL schema doesn't have the `type Subscription` defined, or the `@stream` / `@defer` / `@live` directives available, you'll get `RESPONSE` in your result payload, so you can just use `sendResult` helper to send the response data in one line of code.

If you wish to have more control over you transports, you can use one of the following exported helpers:

- `sendResponseResult` - matches the `RESPONSE` type.
- `sendMultipartResponseResult` - matches the `MULTIPART_RESPONSE` type.
- `sendPushResult` - matches the `PUSH` type.

And you'll be able to construct a custom flow. Here's a quick example for customizing the response per each type of result:

```ts
if (result.type === "RESPONSE") {
  sendResponseResult(result, res);
} else if (result.type === "MULTIPART_RESPONSE") {
  sendMultipartResponseResult(result, res);
} else if (result.type === "PUSH") {
  sendPushResult(result, res);
}
```

> This way you can also disable specific responses if you wish, by return an error instead of calling the helpers.

Checkout docs to learn more.
