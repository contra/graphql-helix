import fastify, { RouteHandlerMethod } from "fastify";
import { getGraphQLParameters, processRequest, renderGraphiQL, sendResponse, shouldRenderGraphiQL } from "../../lib";
import { schema } from "../schema";
import { Request, Response } from 'undici';
import { ReadableStream } from "stream/web";

const graphqlHandler: RouteHandlerMethod = async (req, res) => {
  const request: any = new Request('http://localhost/' + req.url, {
    ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : undefined),
    headers: req.headers as any,
    method: req.method,
  })
  const { operationName, query, variables } = await getGraphQLParameters(request);
  const response = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
    Response: Response as any,
    ReadableStream,
  });

  sendResponse(response, res.raw);
  // Tell fastify a response was sent
  res.sent = true;
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
    const request: any = new Request('http://localhost/' + req.url, {
      ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : undefined),
      headers: req.headers as any,
      method: req.method,
    })

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
