import { GraphQLLiveDirective } from "@n1ru4l/graphql-live-query";
import { InMemoryLiveQueryStore } from "@n1ru4l/in-memory-live-query-store";
import { GraphQLInt, GraphQLObjectType, GraphQLSchema } from "graphql";
import express from "express";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "../../lib";

const liveQueryStore = new InMemoryLiveQueryStore();

let favoriteNumber = 42;

export const schema = new GraphQLSchema({
  mutation: new GraphQLObjectType({
    name: "Mutation",
    fields: () => ({
      setFavoriteNumber: {
        args: {
          number: {
            type: GraphQLInt,
          },
        },
        type: GraphQLInt,
        resolve: (_root, args, context) => {
          favoriteNumber = args.number;

          context.liveQueryStore.invalidate(`Query.favoriteNumber`);

          return args.number;
        },
      },
    }),
  }),
  query: new GraphQLObjectType({
    name: "Query",
    fields: () => ({
      favoriteNumber: {
        type: GraphQLInt,
        resolve: () => {
          return favoriteNumber;
        },
      },
    }),
  }),
  directives: [GraphQLLiveDirective],
});

const app = express();

app.use(express.json());

app.use("/graphql", async (req, res) => {
  // Create a generic Request object that can be consumed by Graphql Helix's API
  const request = {
    body: req.body,
    headers: req.headers,
    method: req.method,
    query: req.query,
  };

  // Determine whether we should render GraphiQL instead of returning an API response
  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL());
  } else {
    // Extract the GraphQL parameters from the request
    const { operationName, query, variables } = getGraphQLParameters(request);

    // Validate and execute the query
    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
      contextFactory: () => ({
        liveQueryStore,
      }),
      execute: liveQueryStore.execute,
    });

    // processRequest will return one of three types of results
    // 1) RESPONSE: a regular JSON payload
    // 2) MULTIPART RESPONSE: a multipart response if @stream or @defer directives were used
    // 3) PUSH: a stream of events to push back down the client for a subscription
    if (result.type === "RESPONSE") {
      // We set the provided status and headers and just the send the payload back to the client
      result.headers.forEach(({ name, value }) => res.setHeader(name, value));
      res.status(result.status);
      res.json(result.payload);
    } else if (result.type === "MULTIPART_RESPONSE") {
      // Indicate we're sending a multipart response
      res.writeHead(200, {
        Connection: "keep-alive",
        "Content-Type": 'multipart/mixed; boundary="-"',
        "Transfer-Encoding": "chunked",
      });

      // If the request is closed by the client, we unsubscribe and stop executing the request
      req.on("close", () => {
        result.unsubscribe();
      });

      // Subscribe and send back each result as a separate chunk. We await the subscribe
      // call. Once we're done executing the request and there are no more results to send
      // to the client, the Promise returned by subscribe will resolve and we can end the response.
      await result.subscribe((result) => {
        const chunk = Buffer.from(JSON.stringify(result), "utf8");
        const data = [
          "",
          "---",
          "Content-Type: application/json; charset=utf-8",
          "Content-Length: " + String(chunk.length),
          "",
          chunk,
          "",
        ].join("\r\n");
        res.write(data);
      });

      res.write("\r\n-----\r\n");
      res.end();
    } else {
      // Indicate we're sending an event stream to the client
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      });

      // If the request is closed by the client, we unsubscribe and stop executing the request
      req.on("close", () => {
        result.unsubscribe();
      });

      // We subscribe to the event stream and push any new events to the client
      await result.subscribe((result) => {
        res.write(`data: ${JSON.stringify(result)}\n\n`);
      });
    }
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
