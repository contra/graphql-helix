import express from "express";
import { parse, DocumentNode, GraphQLError } from "graphql";
import {
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "graphql-helix";
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
        errors: [
          new GraphQLError(
            `Could not find a persisted query with an id of ${queryId}`
          ),
        ],
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

      await result.subscribe((result) => {
        const chunk = Buffer.from(JSON.stringify(result), "utf8");
        const data = [
          "",
          "---",
          "Content-Type: application/json; charset=utf-8",
          "Content-Length: " + String(chunk.length),
          "",
          chunk,
          "",
        ].join("\r\n");
        res.write(data);
      });

      res.write("\r\n-----\r\n");
      res.end();
    } else {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      });

      req.on("close", () => {
        result.unsubscribe();
      });

      await result.subscribe((result) => {
        res.write(`data: ${JSON.stringify(result)}\n\n`);
      });
    }
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
