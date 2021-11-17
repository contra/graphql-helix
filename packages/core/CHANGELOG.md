# graphql-helix

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
