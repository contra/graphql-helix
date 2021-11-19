---
"graphql-helix": minor
---

Adjust the handling of the `accept` header.

- Clients accepting the `application/graphql+json` header (via the `accept` header) will receive responses that use `Content-Type: application/graphql+json` over `application/json` ([which is only for supporting legacy clients](https://github.com/graphql/graphql-over-http/blob/main/spec/GraphQLOverHTTP.md#content-types)).
  Clients that do not specify any `accept` headers will still receive `Content-Type: application/graphql`. This is not considered a breaking change as clients accepting the `application/graphql+json` header should also be able to process it.
- GET `text/event-stream` requests will now ALWAYS return a `PushResponse` instead of a `MultipartResponse`. Previously helix would send a `MultipartResponse` if the accept header was not a strict equal to `accept: text/event-stream`.
- POST requests that try to execute Subscription operation will now receive an error and 405 status code. This is not considered a breaking change as SSE is not doable over POST by the specification and was never officially supported.
