import Koa, { Context } from "koa";
import bodyParser from "koa-bodyparser";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "../../lib";
import { schema } from "../schema";

const graphqlHandler = async (ctx: Context) => {
  const request = await getNodeRequest(ctx.request);
  const { operationName, query, variables } = await getGraphQLParameters(request);
  const response = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
  });

  ctx.req.socket.setTimeout(0);
  ctx.req.socket.setNoDelay(true);
  ctx.req.socket.setKeepAlive(true);

  await sendNodeResponse(response, ctx.res);
};

const graphiqlHandler = async (ctx: Context) => {
  ctx.body = renderGraphiQL({});
};

const app = new Koa();

app.use(async (ctx) => {
  if (ctx.path === "/graphql") {
    await graphqlHandler(ctx);
  } else if (ctx.path === "/graphiql") {
    await graphiqlHandler(ctx);
  } else {
    const request = await getNodeRequest(ctx.request);

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
