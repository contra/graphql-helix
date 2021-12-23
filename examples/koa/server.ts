import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, shouldRenderGraphiQL } from "graphql-helix";
import { schema } from "./schema";
import { Readable } from "stream";

declare module "koa" {
  interface Request {
    body?: any;
    rawBody: string;
  }
}

const app = new Koa();

app.use(bodyParser());

app.use(async (ctx) => {
  const request = await getNodeRequest(ctx.request);

  if (shouldRenderGraphiQL(request)) {
    ctx.body = renderGraphiQL({});
  } else {
    const { operationName, query, variables } = await getGraphQLParameters(request);

    const response = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    ctx.status = response.status;

    response.headers.forEach((value, key) => {
      ctx.set(key, value)
    });

    ctx.body = Readable.from(response.body as any);
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
