import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { PassThrough } from "stream";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { schema } from "./schema";

const app = new Koa();

app.use(bodyParser());

app.use(async (ctx) => {
  const request = {
    body: ctx.request.body,
    headers: ctx.req.headers,
    method: ctx.request.method,
    query: ctx.request.query,
  };

  if (shouldRenderGraphiQL(request)) {
    ctx.body = renderGraphiQL({});
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
      result.headers.forEach(({ name, value }) =>
        ctx.response.set(name, value)
      );
      ctx.status = result.status;
      ctx.body = result.payload;
    } else if (result.type === "PUSH") {
      ctx.req.socket.setTimeout(0);
      ctx.req.socket.setNoDelay(true);
      ctx.req.socket.setKeepAlive(true);

      ctx.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const stream = new PassThrough();

      stream.on("close", () => {
        result.unsubscribe();
      });

      ctx.status = 200;
      ctx.body = stream;

      result.subscribe((result) => {
        stream.write(`data: ${JSON.stringify(result)}\n\n`);
      });
    } else {
      ctx.req.socket.setTimeout(0);
      ctx.req.socket.setNoDelay(true);
      ctx.req.socket.setKeepAlive(true);

      ctx.set({
        Connection: "keep-alive",
        "Content-Type": 'multipart/mixed; boundary="-"',
        "Transfer-Encoding": "chunked",
      });

      const stream = new PassThrough();

      stream.on("close", () => {
        result.unsubscribe();
      });

      ctx.status = 200;
      ctx.body = stream;

      result
        .subscribe((result) => {
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
          stream.write(data);
        })
        .then(() => {
          stream.write("\r\n-----\r\n");
          stream.end();
        });
    }
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
