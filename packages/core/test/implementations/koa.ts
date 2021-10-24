import Koa, { Context } from "koa";
import bodyParser from "koa-bodyparser";
import { PassThrough } from "stream";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL } from "../../lib";
import { schema } from "../schema";

const graphqlHandler = async (ctx: Context) => {
  const request = {
    body: ctx.request.body,
    headers: ctx.req.headers,
    method: ctx.request.method,
    query: ctx.request.query,
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
    result.headers.forEach(({ name, value }) => ctx.response.set(name, value));
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

    result
      .subscribe((result) => {
        stream.write(`data: ${JSON.stringify(result)}\n\n`);
      })
      .then(() => {
        stream.end();
      });
  } else {
    ctx.request.socket.setTimeout(0);
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

    stream.write("---");

    result
      .subscribe((result) => {
        const chunk = Buffer.from(JSON.stringify(result), "utf8");
        const data = ["", "Content-Type: application/json; charset=utf-8", "Content-Length: " + String(chunk.length), "", chunk];

        if (result.hasNext) {
          data.push("---");
        }

        stream.write(data.join("\r\n"));
      })
      .then(() => {
        stream.write("\r\n-----\r\n");
        stream.end();
      });
  }
};

const graphiqlHandler = async (ctx: Context) => {
  ctx.body = renderGraphiQL({});
};

const app = new Koa();

app.use(bodyParser());

app.use(async (ctx) => {
  if (ctx.path === "/graphql") {
    await graphqlHandler(ctx);
  } else if (ctx.path === "/graphiql") {
    await graphiqlHandler(ctx);
  } else {
    const request = {
      body: ctx.request.body,
      headers: ctx.req.headers,
      method: ctx.request.method,
      query: ctx.request.query,
    };

    if (shouldRenderGraphiQL(request)) {
      await graphiqlHandler(ctx);
    } else {
      await graphqlHandler(ctx);
    }
  }
});

export default {
  name: "koa",
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
