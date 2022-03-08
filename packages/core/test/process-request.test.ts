import { getGraphQLParameters, processRequest } from "../lib";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLError } from "graphql";

const schema = makeExecutableSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      hello: String
    }
    type Subscription {
      countdown(from: Int): Int
    }
  `,
  resolvers: {
    Subscription: {
      countdown: {
        subscribe: async function* () {
          yield "Hi";
        },
      },
    },
  },
});

describe("process-request", () => {
  it("should not allow POST if disabled", async () => {
    const request = {
      body: { query: "subscription { countdown }" },
      method: "POST",
      headers: {},
      query: "",
    };

    const { operationName, query, variables } = getGraphQLParameters(request);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
      allowedSubscriptionHttpMethods: ["GET"],
    });

    expect(result.type).toBe("RESPONSE");
    expect((result as any).status).toBe(405);
    expect((result as any).payload.errors[0] instanceof GraphQLError).toBe(true);
  });
});
