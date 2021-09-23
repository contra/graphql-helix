import express from "express";
import { parse, DocumentNode, GraphQLError } from "graphql";
import { processRequest, renderGraphiQL, sendResult, shouldRenderGraphiQL } from "graphql-helix";
import { schema } from "./schema";

const queryMap: Record<string, DocumentNode> = {
  "1": parse("{ hello }"),
  "2": parse("{ goodbye }"),
};

const app = express();

app.use(express.json());

app.use("/graphql", async (req, res) => {
  const request = {
    body: req.body,
    headers: req.headers,
    method: req.method,
    query: req.query,
  };

  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL());
  } else {
    let queryId: string;
    let operationName: string | undefined;
    let variables: any;

    if (req.method === "POST") {
      queryId = req.body.queryId;
      operationName = req.body.operationName;
      variables = req.body.variables;
    } else {
      queryId = req.query.queryId as string;
      operationName = req.query.operationName as string;
      variables = req.query.variables;
    }

    const query = queryMap[queryId];

    if (!query) {
      res.status(400);
      res.json({
        errors: [new GraphQLError(`Could not find a persisted query with an id of ${queryId}`)],
      });
      return;
    }

    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    sendResult(result, res);
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
