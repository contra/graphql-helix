import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "graphql-helix";
import { schema } from "./schema";

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

    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    await sendNodeResponse(result, ctx.res);
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
