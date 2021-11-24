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
} = require("../packages/core");
const { Readable } = require("stream");

const app = fastify();

app.route({
  method: ["GET", "POST"],
  url: "/graphql",
  async handler(req, reply) {
    const request = await getNodeRequest(req);

    // @ts-ignore
    if (shouldRenderGraphiQL(request)) {
      reply.type("text/html");
      reply.send(renderGraphiQL({}));
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

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      reply.status(response.status);
      reply.send(Readable.from(response.body));
    }
  },
});

app.listen(5000, () => {
  // eslint-disable-next-line no-console
  console.log(`GraphQL Test Server is running... Ready for K6!`);
});
