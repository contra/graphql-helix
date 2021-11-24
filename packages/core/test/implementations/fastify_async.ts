import fastify, { FastifyReply, RouteHandlerMethod } from "fastify";
import { parse as graphqlParse } from "graphql";
import { Readable } from "stream";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL, sendNodeResponse, getNodeRequest } from "../../lib";
import { schema } from "../schema";

const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(resolve, time));

const graphqlHandler = async (request: Request, reply: FastifyReply) => {
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
  });

  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });

  reply.status(response.status);
  reply.send(Readable.from(response.body));
};

const graphiqlHandler = async (reply: FastifyReply) => {
  reply.type("text/html");
  reply.send(renderGraphiQL({}));
};

const app = fastify();
app.route({
  method: ["GET", "POST", "PUT"],
  url: "/graphql",
  async handler(req, reply) {
    const request = await getNodeRequest(req);

    await graphqlHandler(request, reply);
  },
});

app.route({
  method: ["GET"],
  url: "/graphiql",
  async handler(_req, reply) {
    await graphiqlHandler(reply);
  },
});

app.route({
  method: ["GET", "POST", "PUT"],
  url: "/",
  async handler(req, reply) {
    const request = await getNodeRequest(req);

    if (shouldRenderGraphiQL(request)) {
      await graphiqlHandler(reply);
    } else {
      await graphqlHandler(request, reply);
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
