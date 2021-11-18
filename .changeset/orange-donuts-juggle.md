---
"graphql-helix": patch
---

Handle errors thrown by subscribe handlers.

Previously any error raised with a `subscribe` handler on the `Subscription` root type was not handled and forwarded to `formatPayload`, which could potentially lead to error message leaking to clients.
