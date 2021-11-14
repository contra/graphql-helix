import express from "express";
import expressSession from "express-session";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL, sendNodeResponse } from "graphql-helix";
import { schema } from "./schema";

const app = express();

app.use(express.json());

app.use(
  expressSession({
    resave: true,
    saveUninitialized: true,
    secret: "secret",
  })
);

app.use("/graphql", async (req, res) => {
  const request = {
    url: `${req.protocol}://${req.headers.host}${req.url}`,
    json: async () => req.body,
    headers: {
      get: (key: string) => req.headers[key]
    },
    method: req.method,
  };

  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL());
  } else {
    const { operationName, query, variables } = await getGraphQLParameters(request);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
      contextFactory: () => ({
        session: req.session,
      }),
    });

    sendNodeResponse(result, res);
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
