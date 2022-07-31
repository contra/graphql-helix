import { GraphQLSchema } from "graphql";
import { Request, Response, ReadableStream } from "cross-undici-fetch";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { getGraphQLParameters, processRequest, getResponse } from "../lib";
import { parse as qsParse, stringify as qsStringify } from "qs";

declare module "stream/web" {
  export const ReadableStream: any;
}

const executableSchema = makeExecutableSchema({
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

const schema = new GraphQLSchema({ ...executableSchema.toConfig(), enableDeferStream: true });

async function prepareHelixRequestFromW3CRequest(request: Request) {
  const queryString = request.url.split("?")[1];
  return {
    body: request.method === "POST" && (await request.json()),
    headers: request.headers,
    method: request.method,
    query: queryString && qsParse(queryString),
  };
}

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
    const helixRequest = await prepareHelixRequestFromW3CRequest(request);

    const { operationName, query, variables } = getGraphQLParameters(helixRequest);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request: helixRequest,
      schema,
    });

    const response = getResponse(result, Response as any, ReadableStream);
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
    const helixRequest = await prepareHelixRequestFromW3CRequest(request);

    const { operationName, query, variables } = getGraphQLParameters(helixRequest);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request: helixRequest,
      schema,
    });

    const response = getResponse(result, Response as any, ReadableStream);
    const responseJson = await response.json();
    expect(responseJson).toEqual({
      data: {
        hello: "world",
      },
    });
  });
  it("should handle push responses", async () => {
    const queryParams = new URLSearchParams();
    queryParams.set(
      "query",
      /* GraphQL */ `
        subscription Countdown($from: Int!) {
          countdown(from: $from)
        }
      `
    );
    queryParams.set(
      "variables",
      JSON.stringify({
        from: 3,
      })
    );
    const request = new Request("http://localhost:3000/graphql?" + queryParams.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const helixRequest = await prepareHelixRequestFromW3CRequest(request);

    const { operationName, query, variables } = getGraphQLParameters(helixRequest);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request: helixRequest,
      schema,
    });

    const response = getResponse(result, Response as any, ReadableStream);
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
    const helixRequest = await prepareHelixRequestFromW3CRequest(request);

    const { operationName, query, variables } = getGraphQLParameters(helixRequest);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request: helixRequest,
      schema,
    });

    const response = getResponse(result, Response as any, ReadableStream);
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
