---
"graphql-helix": minor
---

Upgrade graphql-js to latest defer/stream version.

Now you need to explicitly enable `defer` and `stream` in `graphql-js` in your schema.
See additional discussion here: [`defer-stream-wg#12`](https://github.com/robrichard/defer-stream-wg/discussions/12)

```ts
import { GraphQLSchema } from "graphql";

const schema = new GraphQLSchema({
  // Somethings here ...
  enableDeferStream: true,
  // Somethings there ...
});
```
