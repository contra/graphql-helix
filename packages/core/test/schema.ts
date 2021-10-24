import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";

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
        resolve: (_root, args) => {
          return args.number;
        },
      },
    }),
  }),
  query: new GraphQLObjectType({
    name: "Query",
    fields: () => ({
      alwaysFalse: {
        type: GraphQLBoolean,
        resolve: () => false,
      },
      alwaysTrue: {
        type: GraphQLBoolean,
        resolve: () => true,
      },
      echo: {
        args: {
          text: {
            type: GraphQLString,
          },
        },
        type: GraphQLString,
        resolve: (_root, args) => args.text,
      },
      hello: {
        type: GraphQLString,
        resolve: () => "hello",
      },
      goodbye: {
        type: GraphQLString,
        resolve: () => new Promise((resolve) => setTimeout(() => resolve("goodbye"), 1000)),
      },
      stream: {
        type: new GraphQLList(GraphQLString),
        resolve: async function* () {
          yield "A";
          await new Promise((resolve) => setTimeout(resolve, 1000));
          yield "B";
          await new Promise((resolve) => setTimeout(resolve, 1000));
          yield "C";
        },
      },
    }),
  }),
  subscription: new GraphQLObjectType({
    name: "Subscription",
    fields: () => ({
      eventEmitted: {
        type: GraphQLFloat,
        subscribe: async function* () {
          yield { eventEmitted: Date.now() };
        },
      },
      count: {
        type: GraphQLInt,
        args: {
          to: {
            type: GraphQLNonNull(GraphQLInt),
          },
        },
        subscribe: async function* (_root, args) {
          for (let count = 1; count <= args.to; count++) {
            yield { count };
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        },
      },
    }),
  }),
});
