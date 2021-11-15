/* eslint-disable @typescript-eslint/ban-ts-comment */
/// @ts-check
const { fastify } = require("fastify");
const schema = require("./schema");
const {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
  sendNodeResponse,
} = require("../packages/core");
const { Request, Response, ReadableStream } = require("cross-undici-fetch");

const app = fastify();

app.route({
  method: ["GET", "POST"],
  url: "/graphql",
  async handler(req, res) {
    const request = new Request(req.url, {
      body: JSON.stringify(req.body),
      // @ts-ignore
      headers: req.headers,
      method: req.method,
    })

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
        // @ts-ignore
        request,
        schema,
        // @ts-ignore
        Response,
        ReadableStream,
      });

      sendNodeResponse(response, res.raw);
      // Tell fastify a response was sent
      res.sent = true;
    }
  },
});

app.listen(5000, () => {
  // eslint-disable-next-line no-console
  console.log(`GraphQL Test Server is running... Ready for K6!`);
});
