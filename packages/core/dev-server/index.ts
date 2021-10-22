import { createServer } from "http";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  RenderGraphiQLOptions,
  sendResult,
  shouldRenderGraphiQL,
} from "../lib";
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
      const rawGraphiQLOpts = url.searchParams.get("graphiql_options");
      const opts: RenderGraphiQLOptions = {};
      if (rawGraphiQLOpts) {
        Object.assign(opts, JSON.parse(rawGraphiQLOpts));
      }
      res.writeHead(200, {
        "content-type": "text/html",
      });
      res.end(renderGraphiQL(opts));
    } else {
      const { operationName, query, variables } = getGraphQLParameters(request);

      const result = await processRequest({
        operationName,
        query,
        variables,
        request,
        schema,
      });

      await sendResult(result, res);
    }
  });
});

export const startDevServer = (port = 4000): Promise<() => Promise<void>> => {
  return new Promise((resolve) => {
    server.listen(port, () => {
      // eslint-disable-next-line no-console
      // console.log(`GraphQL server is running on port ${port}.`);
      resolve(
        () =>
          new Promise<void>((resolve, reject) => {
            server.close((err) => {
              if (err) return reject(err);
              resolve();
            });
          })
      );
    });
  });
};
