/* eslint-disable @typescript-eslint/ban-ts-comment */
/// @ts-check
const { fastify } = require("fastify");
const schema = require("./schema");
const {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
  getNodeRequest,
  sendNodeResponse,
} = require("../packages/core");

const app = fastify();

app.route({
  method: ["GET", "POST"],
  url: "/graphql",
  async handler(req, res) {
    const request = await getNodeRequest(req);

    // @ts-ignore
    if (shouldRenderGraphiQL(request)) {
      res.type("text/html");
      res.send(renderGraphiQL({}));
    } else {
      // @ts-ignore
      const { operationName, query, variables } = await getGraphQLParameters(request);
      const response = await processRequest({
        operationName,
        query,
        variables,
        request,
        schema,
      });

      await sendNodeResponse(response, res.raw);
      // Tell fastify a response was sent
      res.sent = true;
    }
  },
});

app.listen(5000, () => {
  // eslint-disable-next-line no-console
  console.log(`GraphQL Test Server is running... Ready for K6!`);
});
