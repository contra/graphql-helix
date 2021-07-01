const { GraphQLObjectType, GraphQLSchema, GraphQLString } = require("graphql");

module.exports = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: () => ({
      song: {
        type: new GraphQLObjectType({
          name: "Song",
          fields: () => ({
            firstVerse: {
              type: GraphQLString,
              resolve: () => "Now I know my ABC's.",
            },
          }),
        }),
        resolve: () => ({}),
      },
    }),
  }),
});
