import express from "express";
import { ExecutionResult, GraphQLError } from "graphql";
import {
  getGraphQLParameters,
  processRequest,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { renderGraphiQL } from "@graphql-helix/graphiql";
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
      return new GraphQLError(
        "Sorry, something went wrong",
        error.nodes,
        error.source,
        error.positions,
        error.path,
        null,
        {
          // Adding some metadata to the error
          timestamp: Date.now(),
        }
      );
    });
  }

  return formattedResult;
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
      res.json(formatResult(result.payload));
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
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      });

      req.on("close", () => {
        result.unsubscribe();
      });

      await result.subscribe((result) => {
        res.write(`data: ${JSON.stringify(formatResult(result))}\n\n`);
      });
    }
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
