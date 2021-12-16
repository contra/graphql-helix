# graphql-helix

## 1.11.0

### Minor Changes

- f07a403: Adjust the handling of the `accept` header.

  - Clients accepting the `application/graphql+json` header (via the `accept` header) will receive responses that use `Content-Type: application/graphql+json` over `application/json` ([which is only for supporting legacy clients](https://github.com/graphql/graphql-over-http/blob/main/spec/GraphQLOverHTTP.md#content-types)).
    Clients that do not specify any `accept` headers will still receive `content-type: application/json`. This is not considered a breaking change as clients accepting the `application/graphql+json` header should also be able to process it.
    Note: When using the `application/graphql+json` content-type header you need to configure your HTTP server/framework to parse this content-type as JSON.
  - GET `text/event-stream` requests will now ALWAYS return a `PushResponse` instead of a `MultipartResponse`. Previously helix would send a `MultipartResponse` if the accept header was not a strict equal to `accept: text/event-stream`.
  - POST requests that try to execute Subscription operations will now receive an error and 405 status code. This is not considered a breaking change as SSE is not doable over POST by the specification and was never officially supported.

## 1.10.3

### Patch Changes

- d6071a1: Set content-length header on sendResponseResult

## 1.10.2

### Patch Changes

- ea28821: fix missing context in subscribe function

## 1.10.1

### Patch Changes

- b6eff48: Handle errors thrown by subscribe handlers.

  Previously any error raised with a `subscribe` handler on the `Subscription` root type was not handled and forwarded to `formatPayload`, which could potentially lead to error message leaking to clients.

## 1.10.0

### Minor Changes

- d50e833: graphiql: allow to store headers in localStorage (false by default)

## 1.9.1

### Patch Changes

- a52d40b: fix(processRequest): pass context as contextValue correctly

## 1.9.0

### Minor Changes

- c8750f3: Added support for GraphQL v16
- 1ada48e: feat: W3C Response handlers

### Patch Changes

- c8750f3: fix broken multi part response and SSE response fetching in GraphiQL

## 1.8.4

### Patch Changes

- f4399bb: terminate SSE HTTP connection after stream ended emitting values
- f4399bb: fix broken multi part response and SSE response fetching in GraphiQL

## 1.8.3

### Patch Changes

- 39c5d9d: fix esm support which resulted in trying to import the wrong files.

## 1.8.2

### Patch Changes

- 03c8416: include esm code in the published package

## 1.8.1

### Patch Changes

- a1ce7db: add esm support

## 1.8.0

### Minor Changes

- 185b64c: Added response helpers for Node.js for reducing boilerplate in projects

### Patch Changes

- 9d6adb7: Improve build flow for GraphiQL
- 91f3fcf: handle graphql error as 200 response #46
- 91f3fcf: Allow user code to throw HttpError during context building #43
