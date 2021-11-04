import Koa, { Context } from "koa";
import bodyParser from "koa-bodyparser";
import { Readable } from "stream";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL } from "../../lib";
import { schema } from "../schema";
import { Request, Response } from 'undici';
import { ReadableStream } from "stream/web";

const graphqlHandler = async (ctx: Context) => {
  const request: any = new Request('http://localhost/' + ctx.request.url, {
    ...(ctx.request.method === 'POST' ? { body: JSON.stringify(ctx.request.body) } : undefined),
    headers: ctx.request.headers as any,
    method: ctx.request.method,
  })
  const { operationName, query, variables } = await getGraphQLParameters(request);
  const response = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
    Response: Response as any,
    ReadableStream,
  });

  ctx.req.socket.setTimeout(0);
  ctx.req.socket.setNoDelay(true);
  ctx.req.socket.setKeepAlive(true);

  response.headers.forEach((value, key) => {
    ctx.set({
      [key]: value
    });
  })

  ctx.status = 200;
  ctx.body = Readable.from(response.body as any);
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
    const request: any = new Request(ctx.request.url, {
      body: JSON.stringify(ctx.request.body),
      headers: ctx.request.headers as any,
      method: ctx.request.method,
    })

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
