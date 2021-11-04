import fastify from "fastify";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "graphql-helix";
import { schema } from "./schema";

const app = fastify();

app.route({
  method: ["GET", "POST"],
  url: "/graphql",
  async handler(req, res) {
    const request = await getNodeRequest(req);

    if (shouldRenderGraphiQL(request)) {
      res.type("text/html");
      res.send(renderGraphiQL({}));
    } else {
      const { operationName, query, variables } = await getGraphQLParameters(request);
      const result = await processRequest({
        operationName,
        query,
        variables,
        request,
        schema,
      });

      await sendNodeResponse(result, res.raw);
    }
  },
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
