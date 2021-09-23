## GraphQL Helix example with GraphQL ontext 

Run this example in CodeSandbox by visiting https://codesandbox.io/s/github/contrawork/graphql-helix/tree/master/examples/context?initialpath=/graphql

This example features:

* Creating a simple GraphQL `Query` and `Mutation`.
* By running the `Mutation.login` you are able to set the session (which is shared and stored on the GraphQL context)
* Then, you should be able to query for `Query.yourName` and get your session.
