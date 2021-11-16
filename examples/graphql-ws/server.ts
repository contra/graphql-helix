import express from "express";
import {
  getGraphQLParameters,
  getNodeRequest,
  processRequest,
  renderGraphiQL,
  sendNodeResponse,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { execute, subscribe } from "graphql";
import { schema } from "./schema";
import * as ws from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

const app = express();

app.use(express.json());

app.use("/graphql", async (req, res) => {
  const request = await getNodeRequest(req);

  if (shouldRenderGraphiQL(request)) {
    res.send(
      renderGraphiQL({
        subscriptionsEndpoint: "ws://localhost:4000/graphql",
      })
    );
    return;
  }

  const { operationName, query, variables } = await getGraphQLParameters(request);

  const response = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
  });

  await sendNodeResponse(response, res);
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
