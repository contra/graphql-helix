/// @ts-check
const { createServer } = require("http");
const schema = require("./schema");
const {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
  getNodeRequest,
  sendNodeResponse,
} = require("../packages/core");

async function handleReqRes(req, res) {
  const request = await getNodeRequest(req);

  if (shouldRenderGraphiQL(request)) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(renderGraphiQL());
  } else {
    const { operationName, query, variables } = await getGraphQLParameters(request);
    const response = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    await sendNodeResponse(response, res);
  }
}

const server = createServer(function (req, res) {
  handleReqRes(req, res);
});

server.listen(5000, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`GraphQL Test Server is running... Ready for K6!`);
});
