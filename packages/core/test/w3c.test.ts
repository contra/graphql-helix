import { makeExecutableSchema } from "@graphql-tools/schema";
import { getGraphQLParameters, getNodeRequest, processRequest, sendNodeResponse } from "../lib";
import { stringify as qsStringify } from "qs";
import fetch, { Request } from "node-fetch";
import { createServer, Server } from "http";
import { PassThrough } from "stream";

const schema = makeExecutableSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      hello: String
      slowHello: String
    }
    type Subscription {
      countdown(from: Int): Int
    }
  `,
  resolvers: {
    Query: {
      hello: () => "world",
      slowHello: () => new Promise((resolve) => setTimeout(() => resolve("world"), 300)),
    },
    Subscription: {
      countdown: {
        subscribe: async function* () {
          for (let i = 3; i >= 0; i--) {
            yield i;
          }
        },
        resolve: (payload) => payload,
      },
    },
  },
});

describe("W3 Compatibility", () => {
  it("should handle regular POST request and responses", async () => {
    const request = new Request("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "{ hello }",
      }),
    });

    const { operationName, query, variables } = await getGraphQLParameters(request);

    const response = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    const responseJson = await response.json();
    expect(responseJson).toEqual({
      data: {
        hello: "world",
      },
    });
  });
  it("should handle regular GET request and responses", async () => {
    const request = new Request(
      "http://localhost:3000/graphql?" +
        qsStringify({
          query: "{ hello }",
        }),
      {
        method: "GET",
      }
    );

    const { operationName, query, variables } = await getGraphQLParameters(request);

    const response = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    const responseJson = await response.json();
    expect(responseJson).toEqual({
      data: {
        hello: "world",
      },
    });
  });
  it("should handle push responses", async () => {
    const request = new Request("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "subscription Countdown($from: Int!) { countdown(from: $from) }",
        variables: {
          from: 3,
        },
      }),
    });
    const { operationName, query, variables } = await getGraphQLParameters(request);

    const response = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    const finalText = await response.text();
    expect(finalText).toMatchInlineSnapshot(`
      "data: {\\"data\\":{\\"countdown\\":3}}

      data: {\\"data\\":{\\"countdown\\":2}}

      data: {\\"data\\":{\\"countdown\\":1}}

      data: {\\"data\\":{\\"countdown\\":0}}

      "
    `);
  });
  it("should handle multipart responses", async () => {
    const request = new Request("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "{ ... on Query @defer { slowHello } hello }",
        variables: {
          from: 3,
        },
      }),
    });

    const { operationName, query, variables } = await getGraphQLParameters(request);

    const response = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    const finalText = await response.text();
    expect(finalText).toMatchInlineSnapshot(`
      "---
      Content-Type: application/json; charset=utf-8
      Content-Length: 41

      {\\"data\\":{\\"hello\\":\\"world\\"},\\"hasNext\\":true}
      ---
      Content-Type: application/json; charset=utf-8
      Content-Length: 56

      {\\"data\\":{\\"slowHello\\":\\"world\\"},\\"path\\":[],\\"hasNext\\":false}
      -----
      "
    `);
  });
});

describe.only("W3 Subscription Node.js", () => {
  let httpServer: Server;
  afterEach(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });
  it("calls return on the subscription source if present", async () => {
    let didCallReturn = false;
    const source: AsyncGenerator<number> = {
      async next() {
        if (didCallReturn === true) {
          return { value: undefined, done: true };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { value: 1, done: false };
      },
      async return() {
        didCallReturn = true;
        return { value: undefined, done: true };
      },
      async throw() {
        throw new Error("NOOP.");
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };

    const schema = makeExecutableSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hello: String
        }
        type Subscription {
          myNumber: Int
        }
      `,
      resolvers: {
        Subscription: {
          myNumber: {
            subscribe: () => source,
            resolve: (a) => a,
          },
        },
      },
    });

    httpServer = createServer(async function handler(req, res) {
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
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(8084, () => resolve());
    });

    const abort = new AbortController();
    const res = await fetch("http://127.0.0.1:8084/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: /* GraphQL */ `
          subscription {
            myNumber
          }
        `,
      }),
      signal: abort.signal,
    });

    const response: PassThrough = res.body as any;

    await new Promise<void>((resolve) => {
      let counter = 0;
      response.on("data", (d) => {
        counter++;

        // console.log(String.fromCharCode.apply(null, d));

        if (counter === 3) {
          abort.abort();
          // TODO: instead of the timeout we should wait for some kind of end or close event...
          setTimeout(() => {
            resolve();
          }, 300);
        }
      });
    });

    expect(didCallReturn).toEqual(true);
  });
});
