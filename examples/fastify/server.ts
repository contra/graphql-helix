import fastify from "fastify";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, shouldRenderGraphiQL } from "graphql-helix";
import { schema } from "./schema";

const app = fastify();

app.route({
  method: ["GET", "POST"],
  url: "/graphql",
  async handler(req, reply) {
    const request = await getNodeRequest(req);

    if (shouldRenderGraphiQL(request)) {
      reply.type("text/html");
      reply.send(renderGraphiQL({}));
    } else {
      const { operationName, query, variables } = await getGraphQLParameters(request);
      const result = await processRequest({
        operationName,
        query,
        variables,
        request,
        schema,
      });


      result.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      reply.status(result.status);
      reply.send(result.body);
    }
  },
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
