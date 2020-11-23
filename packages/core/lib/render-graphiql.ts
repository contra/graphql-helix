import { RenderGraphiQLOptions } from "./types";

export const GRAPHQL_VERSION = "15.4.0-experimental-stream-defer.1";
export const GRAPHIQL_VERSION = "1.0.6";
export const REACT_VERSION = "17.0.1";

export const renderGraphiQL = (options: RenderGraphiQLOptions = {}): string => {
  const { defaultQuery, graphqlEndpoint = "/graphql" } = options;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GraphiQL</title>
  <meta name="robots" content="noindex" />
  <meta name="referrer" content="origin" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      overflow: hidden;
    }
    #graphiql {
      height: 100vh;
    }
  </style>
  <link type="text/css" href="//cdn.jsdelivr.net/npm/graphiql@${GRAPHIQL_VERSION}/graphiql.min.css" rel="stylesheet" />

  <script src="//cdn.jsdelivr.net/npm/react@${REACT_VERSION}/umd/react.production.min.js"></script>
  <script src="//cdn.jsdelivr.net/npm/react-dom@${REACT_VERSION}/umd/react-dom.production.min.js"></script>
  <script src="//cdn.jsdelivr.net/npm/graphiql@${GRAPHIQL_VERSION}/graphiql.min.js"></script>
  <script src="//cdn.jsdelivr.net/npm/lodash@4.17.20/lodash.min.js"></script>
  <script src="//cdn.jsdelivr.net/npm/sse-z@0.3.0/dist/sse-z.min.js"></script>
  <script src="//cdn.jsdelivr.net/npm/meros@0.0.3/dist/index.min.js"></script>
</head>
<body>
  <div id="graphiql">Loading...</div>
  <script>
    // See https://github.com/graphql/graphql-js/issues/2676
    window.process = { env: {} };
  </script>
  <script type="module">
    import { getOperationAST, parse } from "//cdn.jsdelivr.net/npm/graphql@${GRAPHQL_VERSION}/index.mjs";

    const graphqlEndpoint = "${graphqlEndpoint}";

    // Parse the search string to get url parameters.
    const search = window.location.search;
    const parameters = search.substr(1).split("&").reduce((acc, entry) => {
      const eq = entry.indexOf("=");
      if (eq >= 0) {
        acc[decodeURIComponent(entry.slice(0, eq))] = decodeURIComponent(
          entry.slice(eq + 1)
        );
      }
      return acc
    }, {})
    
    // When the query and variables string is edited, update the URL bar so
    // that it can be easily shared
    const onEditQuery = (newQuery) => {
      parameters.query = newQuery;
      updateURL();
    }

    const onEditVariables = (newVariables) => {
      parameters.variables = newVariables;
      updateURL();
    }

    const onEditOperationName = (newOperationName) => {
      parameters.operationName = newOperationName;
      updateURL();
    }

    const updateURL = () => {
      const newSearch =
        "?" +
        Object.keys(parameters)
          .filter((key) => Boolean(parameters[key]))
          .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(parameters[key]))
          .join("&");
      history.replaceState(null, null, newSearch);
    }

    const fetcher = (graphQLParams) => {
      const operationAst = getOperationAST(parse(graphQLParams.query), graphQLParams.operationName);
      const isSubscription = operationAst && operationAst.operation === "subscription";
      if (isSubscription) {
        return {
          subscribe(opts) {
            return new SSEZ.Subscription({
              url: graphqlEndpoint.startsWith("/")
                ? window.location.protocol + "//" + window.location.host + graphqlEndpoint
                : graphqlEndpoint,
              searchParams: {
                query: graphQLParams.query,
                variables: graphQLParams.variables
                  ? JSON.stringify(graphQLParams.variables)
                  : undefined,
                operationName: graphQLParams.operationName,
              },
              eventSourceOptions: {
                withCredentials: true,
              },
              onNext: (data) => {
                opts.next(JSON.parse(data))
              },
            })
          }
        }
      }

      return {
        subscribe() {
          const isIntrospectionQuery = arguments.length === 3;
          const onNext = isIntrospectionQuery ? arguments[0] : arguments[0].next;
          const onError = isIntrospectionQuery ? arguments[1] : arguments[0].error;
          const onComplete = isIntrospectionQuery ? arguments[2] : arguments[0].complete;

          const controller = new AbortController();
          const signal = controller.signal;
          const stream = meros.fetchMultipart(() => fetch(graphqlEndpoint, {
            body: JSON.stringify(graphQLParams),
            credentials: "include",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            method: "POST",
            signal,
          }))

          Promise.resolve().then(async () => {
            let response = {};
            try {
              for await (let chunk of stream) {
                if (chunk.path) {
                  if (chunk.data) {
                    _.merge(response, _.set({}, ['data'].concat(chunk.path),chunk.data));
                  }
  
                  if (chunk.errors) {
                    response.errors = (response.errors || []).concat(chunk.errors);
                  }
                } else {
                  if (chunk.data) {
                    response.data = chunk.data;
                  }
                  if (chunk.errors) {
                    response.errors = chunk.errors;
                  }
                }
                onNext(response)
              }
            } catch (error) {
              if (typeof error.json === "function") {
                const response = await error.json()
                return onError(response)
              } else {
                onError(error)
              }
            }
            onComplete()
          })

          return {
            unsubscribe() {
              controller.abort()
            }
          }
        },
      };
    }

    ReactDOM.render(
      React.createElement(GraphiQL, {
        fetcher,
        onEditQuery,
        onEditVariables,
        onEditOperationName,
        query: parameters.query,
        variables: parameters.variables,
        operationName: parameters.operationName,    
        defaultQuery: ${
          defaultQuery ? JSON.stringify(defaultQuery) : "undefined"
        },
      }),
      document.getElementById('graphiql')
    );
  </script>
</body>
</html>
`;
};
