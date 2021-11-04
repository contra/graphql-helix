/// @ts-check
const { fastify } = require("fastify");
const schema = require("./schema");
const {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} = require("../packages/core");

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
      res.send(renderGraphiQL({}));
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

        for await (const payload of result) {
          res.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
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

        for (const payload of result) {
          const chunk = Buffer.from(JSON.stringify(payload), "utf8");
          const data = [
            "",
            "Content-Type: application/json; charset=utf-8",
            "Content-Length: " + String(chunk.length),
            "",
            chunk,
          ];

          if (payload.hasNext) {
            data.push("---");
          }

          res.raw.write(data.join("\r\n"));
        }

        res.raw.write("\r\n-----\r\n");
        res.raw.end();
      }
    }
  },
});

app.listen(5000, () => {
  // eslint-disable-next-line no-console
  console.log(`GraphQL Test Server is running... Ready for K6!`);
});
