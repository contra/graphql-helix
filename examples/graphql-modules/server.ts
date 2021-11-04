import express from "express";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "graphql-helix";
import { application } from "./application";

const app = express();

app.use(express.json());

app.use("/graphql", async (req, res) => {
  const request = await getNodeRequest(req);

  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL());
  } else {
    const { operationName, query, variables } = await getGraphQLParameters(request);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema: application.schema,
      execute: application.createExecution(),
      subscribe: application.createSubscription(),
    });

    await sendNodeResponse(result, res);
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
