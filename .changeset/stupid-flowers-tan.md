---
"graphql-helix": minor
---

Add better Node.js helpers for building the response for Node.js and fastify.

By using the new response helpers, fastify plugins are fully supported.

The function `toResponsePayload` converts the `processRequest` result into an intermediate format suitable for streaming to clients.
Since fastify does not not support consuming async iterables yet an additional helper for converting the async iterable text stream to a [`Readable` stream](https://nodejs.org/api/stream.html#readable-streams) is necessary.

```ts
import fastify from "fastify";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL } from "graphql-helix";
import { toResponsePayload } from "graphql-helix/to-response-payload";
import { toReadable } from "graphql-helix/node/to-readable";

import { schema } from "./schema";

const app = fastify();

app.route({
  method: ["GET", "POST"],
  url: "/graphql",
  async handler(req, reply) {
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    if (shouldRenderGraphiQL(request)) {
      reply.type("text/html");
      reply.send(renderGraphiQL({}));
    } else {
      const request = {
        body: req.body,
        headers: req.headers,
        method: req.method,
        query: req.query,
      };
      const { operationName, query, variables } = getGraphQLParameters(request);
      const result = await processRequest({
        operationName,
        query,
        variables,
        request,
        schema,
      });

      const responsePayload = toResponsePayload(result);
      reply.status(responsePayload.status);
      reply.headers(responsePayload.headers);
      reply.send(toReadable(responsePayload.source));
    }
  },
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
```
