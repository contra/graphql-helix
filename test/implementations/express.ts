import express, { RequestHandler } from "express";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "../../lib";
import { schema } from "../schema";

const graphqlMiddleware: RequestHandler = async (req, res) => {
  const request = {
    body: req.body,
    headers: req.headers,
    method: req.method,
    query: req.query,
  };
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
  } else if (result.type === "PUSH") {
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
  } else {
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
  }
};

const graphiqlMiddleware: RequestHandler = async (_req, res) => {
  res.send(renderGraphiQL({}));
};

const app = express();

app.use(express.json());

app.use("/graphql", graphqlMiddleware);

app.get("/graphiql", graphiqlMiddleware);

app.use("/", async (req, res, next) => {
  const request = {
    body: req.body,
    headers: req.headers,
    method: req.method,
    query: req.query,
  };

  if (shouldRenderGraphiQL(request)) {
    await graphiqlMiddleware(req, res, next);
  } else {
    await graphqlMiddleware(req, res, next);
  }
});

export default {
  name: "express",
  start: async (port: number) => {
    return new Promise<() => Promise<void>>((resolve, reject) => {
      app.on("error", reject);
      const server = app.listen(port, () => {
        resolve(
          async () =>
            new Promise((resolve) => {
              server.close(() => resolve());
            })
        );
      });
    });
  },
};
