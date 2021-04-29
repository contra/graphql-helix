import fastify, { RouteHandlerMethod } from "fastify";
import { parse as graphqlParse } from "graphql";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "../../lib";
import { schema } from "../schema";

const sleep = (time: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, time));

const graphqlHandler: RouteHandlerMethod = async (req, res) => {
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
    async parse(source, options) {
      await sleep(50);
      return graphqlParse(source, options);
    },
  });

  if (result.type === "RESPONSE") {
    result.headers.forEach(({ name, value }) => res.header(name, value));
    res.status(result.status);
    res.send(result.payload);
  } else if (result.type === "PUSH") {
    res.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    });

    req.raw.on("close", () => {
      result.unsubscribe();
    });

    await result.subscribe((result) => {
      res.raw.write(`data: ${JSON.stringify(result)}\n\n`);
    });
  } else {
    res.raw.writeHead(200, {
      Connection: "keep-alive",
      "Content-Type": 'multipart/mixed; boundary="-"',
      "Transfer-Encoding": "chunked",
    });

    req.raw.on("close", () => {
      result.unsubscribe();
    });

    res.raw.write("---");

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

      res.raw.write(data.join("\r\n"));
    });

    res.raw.write("\r\n-----\r\n");
    res.raw.end();
  }
};

const graphiqlHandler: RouteHandlerMethod = async (_req, res) => {
  res.type("text/html");
  res.send(renderGraphiQL({}));
};

const app = fastify();

app.route({
  method: ["GET", "POST", "PUT"],
  url: "/graphql",
  handler: graphqlHandler,
});

app.route({
  method: ["GET"],
  url: "/graphiql",
  handler: graphiqlHandler,
});

app.route({
  method: ["GET", "POST", "PUT"],
  url: "/",
  async handler(req, res) {
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    if (shouldRenderGraphiQL(request)) {
      await graphiqlHandler.call(this, req, res);
    } else {
      await graphqlHandler.call(this, req, res);
    }
  },
});

export default {
  name: "async_fastify",
  start: async (port: number) => {
    await app.listen(port);

    return async () => app.close();
  },
};
