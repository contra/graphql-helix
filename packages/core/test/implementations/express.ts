import express, { RequestHandler } from "express";
import { getGraphQLParameters, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "../../lib";
import { schema } from "../schema";
import { Request, Response } from 'undici';
import { ReadableStream } from "stream/web";

declare module "stream/web" {
  export const ReadableStream: any;
}

const graphqlMiddleware: RequestHandler = async (req, res) => {
  const request = new Request(`${req.protocol}://${req.headers.host}${req.url}`, {
    ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : undefined),
    headers: req.headers as any,
    method: req.method,
  });
  const { operationName, query, variables } = await getGraphQLParameters(request);
  const response = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
    Response: Response as any,
    ReadableStream
  });

  sendNodeResponse(response, res);
};

const graphiqlMiddleware: RequestHandler = async (_req, res) => {
  res.send(renderGraphiQL({}));
};

const app = express();

app.use(express.json());

app.use("/graphql", graphqlMiddleware);

app.get("/graphiql", graphiqlMiddleware);

app.use("/", async (req, res, next) => {
  const request: any = new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
    ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : undefined),
    headers: req.headers as any,
    method: req.method,
  })

  if (shouldRenderGraphiQL(request)) {
    await graphiqlMiddleware(req, res, next);
  } else {
    await graphqlMiddleware(req, res, next);
  }
});

export default {
  name: "express",
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

