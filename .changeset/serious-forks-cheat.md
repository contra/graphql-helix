---
"graphql-helix": patch
---

fix(processRequest): handle contextValue correctly
enhance(types): better signature for custom execute and subscribe
enhance(processRequest): create single instance of AsyncIterator from AsyncIterable and destroy that one at the end