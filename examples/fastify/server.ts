import fastify from "fastify";
import {
  getGraphQLParameters,
  processRequest,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { renderGraphiQL } from "@graphql-helix/graphiql";
import { schema } from "./schema";

const app = fastify();

app.route({
  method: ["GET", "POST"],
  url: "/graphql",
  async handler(req, res) {
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    if (shouldRenderGraphiQL(request)) {
      res.type("text/html");
      res.send(
        renderGraphiQL({
          hybridSubscriptionTransportConfig: {
            default: "sse",
            config: {
              sse: "/graphql",
            },
          },
        })
      );
    } else {
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
    }
  },
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
