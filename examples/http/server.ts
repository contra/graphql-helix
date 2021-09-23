import { createServer } from "http";
import { getGraphQLParameters, processRequest, renderGraphiQL, sendResult, shouldRenderGraphiQL } from "graphql-helix";
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

      sendResult(result, res);
    }
  });
});

const port = process.env.PORT || 4000;

server.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
