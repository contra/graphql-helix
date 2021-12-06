import { GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLString } from "graphql";

// You can also use `Upload` name like `graphql-upload`
const GraphQLFile = new GraphQLScalarType({
  name: 'File',
  description: 'The `File` scalar type represents a `File` or `Blob` type.',
  // Scalar shouldn't touch the values
  parseValue: value => value,
  serialize: value => value,
})

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: () => ({
      upload: {
        args: {
          file: {
            type: GraphQLFile,
          },
        },
        type: GraphQLString,
        resolve: async (_root, args: { file: File }) => {
          const content = await args.file.text();

          return `You uploaded ${args.file.name} with ${content} -- that's a really nice file!`;
        },
      },
    }),
  }),
});
