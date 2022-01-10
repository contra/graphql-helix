import fastify from "fastify";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL } from "graphql-helix";
// @ts-ignore
import { toResponsePayload } from "graphql-helix/send-result/to-response-payload";
// @ts-ignore
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
      reply.headers(responsePayload.headers);
      reply.send(toReadable(responsePayload.source));
    }
  },
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
