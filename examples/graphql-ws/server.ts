import express from "express";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendMultipartResponseResult,
  sendResponseResult,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { execute, subscribe, GraphQLError } from "graphql";
import { schema } from "./schema";
import * as ws from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

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
    res.send(
      renderGraphiQL({
        subscriptionsEndpoint: "ws://localhost:4000/graphql",
      })
    );
    return;
  }

  const { operationName, query, variables } = getGraphQLParameters(request);

  const result = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
  });

  if (result.type === "RESPONSE") {
    sendResponseResult(result, res);
  } else if (result.type === "MULTIPART_RESPONSE") {
    sendMultipartResponseResult(result, res);
  } else {
    res.status(422);
    res.json({
      errors: [new GraphQLError("Subscriptions should be sent over WebSocket.")],
    });
  }
});

const port = process.env.PORT || 4000;

const server = app.listen(port, () => {
  const wsServer = new ws.Server({
    server,
    path: "/graphql",
  });

  useServer({ schema, execute, subscribe }, wsServer);

  console.log(`GraphQL server is running on port ${port}.`);
});
