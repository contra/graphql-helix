import { parse } from "graphql";
import { createApplication, createModule } from "graphql-modules";

const myModule = createModule({
  id: "my-module",
  dirname: __dirname,
  typeDefs: [
    parse(`
    type Query {
      alphabet: [String]
      song: Song
    }

    type Song {
      firstVerse: String
      secondVerse: String
    }

    type Mutation {
      echo(text: String): String
    }

    type Subscription {
      count(to: Int): Int
    }
  `),
  ],
  resolvers: {
    Query: {
      alphabet: async function* () {
        for (let letter = 65; letter <= 90; letter++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          yield String.fromCharCode(letter);
        }
      },
      song: () => ({}),
    },
    Song: {
      firstVerse: () => "Now I know my ABC's.",
      secondVerse: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve("Next time won't you sing with me?"), 5000)
        ),
    },
    Mutation: {
      echo: (_root: any, args: any) => args.text,
    },
    Subscription: {
      count: {
        subscribe: async function* (_root: any, args: any) {
          for (let count = 1; count <= args.to; count++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            yield { count };
          }
        },
      },
    },
  },
});

export const application = createApplication({ modules: [myModule] });
