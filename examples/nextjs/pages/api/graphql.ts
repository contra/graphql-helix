import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "graphql-helix";
import { NextApiHandler } from "next/types";
import { schema } from "../../schema";

export default (async (req, res) => {
  const request = await getNodeRequest(req);

  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL({ endpoint: "/api/graphql" }));
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
}) as NextApiHandler;
