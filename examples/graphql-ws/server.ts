import express from "express";
import {
  getGraphQLParameters,
  processRequest,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { renderGraphiQL } from "@graphql-helix/graphiql";
import { execute, subscribe, GraphQLError } from "graphql";
import { useServer } from "graphql-ws/lib/use/ws";
import ws from "ws";
import { schema } from "./schema";

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
    result.headers.forEach(({ name, value }) => res.setHeader(name, value));
    res.status(result.status);
    res.json(result.payload);
  } else if (result.type === "MULTIPART_RESPONSE") {
    res.writeHead(200, {
      Connection: "keep-alive",
      "Content-Type": 'multipart/mixed; boundary="-"',
      "Transfer-Encoding": "chunked",
    });

    req.on("close", () => {
      result.unsubscribe();
    });

    res.write("---");

    await result.subscribe((result) => {
      const chunk = Buffer.from(JSON.stringify(result), "utf8");
      const data = [
        "",
        "Content-Type: application/json; charset=utf-8",
        "Content-Length: " + String(chunk.length),
        "",
        chunk,
      ];

      if (result.hasNext) {
        data.push("---");
      }

      res.write(data.join("\r\n"));
    });

    res.write("\r\n-----\r\n");
    res.end();
  } else {
    res.status(422);
    res.json({
      errors: [
        new GraphQLError("Subscriptions should be sent over WebSocket."),
      ],
    });
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  const wsServer = new ws.Server({
    port: typeof port === "number" ? port : parseInt(port),
    path: "/graphql",
  });
  useServer(
    {
      schema,
      execute,
      subscribe,
    },
    wsServer
  );

  console.log(`GraphQL server is running on port ${port}.`);
});
