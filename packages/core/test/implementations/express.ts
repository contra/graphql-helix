import express, { RequestHandler } from "express";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "../../lib";
import { schema } from "../schema";

const graphqlMiddleware: RequestHandler = async (req, res) => {
  const request = await getNodeRequest(req);
  const { operationName, query, variables } = await getGraphQLParameters(request);
  const response = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
  });

  await sendNodeResponse(response, res);
};

const graphiqlMiddleware: RequestHandler = async (_req, res) => {
  res.send(renderGraphiQL({}));
};

const app = express();

app.use(express.json());

app.use("/graphql", graphqlMiddleware);

app.get("/graphiql", graphiqlMiddleware);

app.use("/", async (req, res, next) => {
  const request = await getNodeRequest(req);

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

