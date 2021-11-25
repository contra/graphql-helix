import { makeExecutableSchema } from "@graphql-tools/schema";
import { getGraphQLParameters, processRequest } from "../lib";
import { stringify as qsStringify } from "qs";
import { Request } from "../lib/util/w3-ponyfills/Request";

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
