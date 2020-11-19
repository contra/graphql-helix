import { createServer } from "http";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { URL, URLSearchParams } from "url";
import { schema } from "./schema";

const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const searchParams = new URLSearchParams(url.search);

  if (url.pathname !== "/graphql") {
    res.writeHead(404, {
      "content-type": "text/plain",
    });
    res.end("Not found");
    return;
  }

  let payload = "";

  req.on("data", (chunk) => {
    payload += chunk.toString();
  });

  req.on("end", async () => {
    const request = {
      body: JSON.parse(payload || "{}"),
      headers: req.headers,
      method: req.method!,
      query: Object.fromEntries(searchParams),
    };

    if (shouldRenderGraphiQL(request)) {
      res.writeHead(200, {
        "content-type": "text/html",
      });
      res.end(renderGraphiQL());
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
        res.writeHead(result.status, {
          "content-type": "application/json",
        });
        res.end(JSON.stringify(result.payload));
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
});

const port = process.env.PORT || 4000;

server.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
