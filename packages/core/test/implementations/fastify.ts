import fastify, { RouteHandlerMethod } from "fastify";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL } from "../../lib";
import { toResponsePayload } from "../../lib/to-response-payload";
import { toReadable } from "../../lib/node/to-readable";

import { schema } from "../schema";

const graphqlHandler: RouteHandlerMethod = async (req, reply) => {
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
};

const graphiqlHandler: RouteHandlerMethod = async (_req, res) => {
  res.type("text/html");
  res.send(renderGraphiQL({}));
};

const app = fastify();

app.route({
  method: ["GET", "POST", "PUT"],
  url: "/graphql",
  handler: graphqlHandler,
});

app.route({
  method: ["GET"],
  url: "/graphiql",
  handler: graphiqlHandler,
});

app.route({
  method: ["GET", "POST", "PUT"],
  url: "/",
  async handler(req, res) {
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    if (shouldRenderGraphiQL(request)) {
      await graphiqlHandler.call(this, req, res);
    } else {
      await graphqlHandler.call(this, req, res);
    }
  },
});

export default {
  name: "fastify",
  start: async (port: number) => {
    await app.listen(port);

    return async () => app.close();
  },
};
