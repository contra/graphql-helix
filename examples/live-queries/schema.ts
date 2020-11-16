import { GraphQLLiveDirective } from "@n1ru4l/graphql-live-query";
import { GraphQLInt, GraphQLObjectType, GraphQLSchema } from "graphql";

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
