import { GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";

export const schema = new GraphQLSchema({
  mutation: new GraphQLObjectType({
    name: "Mutation",
    fields: () => ({
      login: {
        args: {
          name: {
            type: GraphQLString,
          },
        },
        type: GraphQLString,
        resolve: (_root, args, ctx) => {
          ctx.session.name = args.name;
          return "Logged in!";
        },
      },
      logout: {
        type: GraphQLString,
        resolve: async (_root, _args, ctx) => {
          await new Promise<void>((resolve) =>
            ctx.session.destroy(() => resolve())
          );
          return "Logged out!";
        },
      },
    }),
  }),
  query: new GraphQLObjectType({
    name: "Query",
    fields: () => ({
      yourName: {
        type: GraphQLString,
        resolve: async function (_root, _args, ctx) {
          return ctx.session.name;
        },
      },
    }),
  }),
});
