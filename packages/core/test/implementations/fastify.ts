import fastify, { RouteHandlerMethod } from "fastify";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "../../lib";
import { schema } from "../schema"; 

const graphqlHandler: RouteHandlerMethod = async (req, res) => {
  const request = getNodeRequest(req);
  const { operationName, query, variables } = await getGraphQLParameters(request);
  const response = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
  });

  sendNodeResponse(response, res.raw);
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
    const request = getNodeRequest(req);

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
