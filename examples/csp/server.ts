import { randomBytes } from "crypto";
import express from "express";
import {
  getGraphQLParameters,
  processRequest,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { renderGraphiQL } from "@graphql-helix/graphiql";
import helmet from "helmet";
import { schema } from "./schema";

const app = express();

app.use(express.json());

app.use((_req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString("hex");
  next();
});

app.use((req, res, next) =>
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'", "data:", `'nonce-${res.locals.cspNonce}'`],
      },
    },
  })(req, res, next)
);

app.use("/graphql", async (req, res) => {
  const request = {
    body: req.body,
    headers: req.headers,
    method: req.method,
    query: req.query,
  };

  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL({ nonce: res.locals.cspNonce }));
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
