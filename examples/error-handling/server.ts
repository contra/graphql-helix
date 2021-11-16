import express from "express";
import { ExecutionResult, GraphQLError } from "graphql";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL, getNodeRequest, sendNodeResponse } from "graphql-helix";
import { schema } from "./schema";

const formatResult = (result: ExecutionResult) => {
  const formattedResult: ExecutionResult = {
    data: result.data,
  };

  if (result.errors) {
    formattedResult.errors = result.errors.map((error) => {
      // Log the error using the logger of your choice
      console.log(error);

      // Return a generic error message instead
      return new GraphQLError("Sorry, something went wrong", error.nodes, error.source, error.positions, error.path, null, {
        // Adding some metadata to the error
        timestamp: Date.now(),
      });
    });
  }

  return formattedResult;
};

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
      schema,
      formatPayload: ({ payload }) => formatResult(payload),
    });

    await sendNodeResponse(result, res);
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
