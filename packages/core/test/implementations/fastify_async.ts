import fastify, { RouteHandlerMethod } from "fastify";
import { parse as graphqlParse } from "graphql";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL, sendResponse } from "../../lib";
import { schema } from "../schema";
import { ReadableStream } from "stream/web";

const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(resolve, time));

const graphqlHandler: RouteHandlerMethod = async (req, res) => {
  const request: any = new Request(req.url, {
    body: JSON.stringify(req.body),
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
    async parse(source, options) {
      await sleep(50);
      return graphqlParse(source, options);
    },
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
    const request: any = new Request(req.url, {
      body: JSON.stringify(req.body),
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
  name: "async_fastify",
  start: async (port: number) => {
    await app.listen(port);

    return async () => app.close();
  },
};
