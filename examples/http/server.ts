import { createServer } from "http";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  getNodeRequest,
  sendNodeResponse,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { schema } from "./schema";

const server = createServer(async (req, res) => {
  const request = await getNodeRequest(req);

  if (shouldRenderGraphiQL(request)) {
    res.writeHead(200, {
      "content-type": "text/html",
    });
    res.end(renderGraphiQL());
  } else {
    const { operationName, query, variables } = await getGraphQLParameters(request);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    await sendNodeResponse(result, res);
  }
});

const port = process.env.PORT || 4000;

server.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
