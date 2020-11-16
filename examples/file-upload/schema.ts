import { GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";
import { GraphQLUpload } from "graphql-upload";

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: () => ({
      upload: {
        args: {
          file: {
            type: GraphQLUpload,
          },
        },
        type: GraphQLString,
        resolve: async (_root, args) => {
          const { filename } = await args.file;

          return `You uploaded ${filename} -- that's a really nice file!`;
        },
      },
    }),
  }),
});
