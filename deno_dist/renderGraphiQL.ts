import { RenderGraphiQLOptions } from "./types.ts";

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
</head>
<body>
  <div id="graphiql">Loading...</div>
  <script>
    // See https://github.com/graphql/graphql-js/issues/2676
    window.process = { env: {} };
  </script>
  <script type="module">
    import { getOperationAST, parse } from "//cdn.jsdelivr.net/npm/graphql@15.4.0-experimental-stream-defer.1/index.mjs";

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

    const getDelimiter = (boundary) => {
      return "\\r\\n--" + boundary + "\\r\\n";
    }
    
    const getFinalDelimiter = (boundary) => {
      return "\\r\\n--" + boundary + "--\\r\\n";
    }
    
    const splitWithRest = (string, delim) => {
      const index = string.indexOf(delim);
      if (index < 0) {
        return [string];
      }
      return [string.substring(0, index), string.substring(index + delim.length)];
    }
    
    const parseMultipartHttp = (buffer, boundary, previousParts = []) => {
      const delimeter = getDelimiter(boundary);
      let [, rest] = splitWithRest(buffer, delimeter);
      if (!(rest && rest.length)) {
        // we did not finish receiving the initial delimeter
        return {
          newBuffer: buffer,
          parts: previousParts,
        };
      }
      const parts = splitWithRest(rest, '\\r\\n\\r\\n');
      const headers = parts[0];
      rest = parts[1];
    
      if (!(rest && rest.length)) {
        // we did not finish receiving the headers
        return {
          newBuffer: buffer,
          parts: previousParts,
        };
      }
    
      const headersArr = headers.split('\\r\\n');
      const contentLengthHeader = headersArr.find(
        (headerLine) => headerLine.toLowerCase().indexOf('content-length:') >= 0
      );
      if (contentLengthHeader === undefined) {
        throw new Error('Invalid MultiPart Response, no content-length header');
      }
      const contentLengthArr = contentLengthHeader.split(':');
      let contentLength;
      if (contentLengthArr.length === 2 && !isNaN(parseInt(contentLengthArr[1]))) {
        contentLength = parseInt(contentLengthArr[1]);
      } else {
        throw new Error('Invalid MultiPart Response, could not parse content-length');
      }
    
      // Strip out the final delimiter
      const finalDelimeter = getFinalDelimiter(boundary);
      rest = rest.replace(finalDelimeter, '');
      const uint = new TextEncoder().encode(rest);
    
      if (uint.length < contentLength) {
        // still waiting for more body to be sent;
        return {
          newBuffer: buffer,
          parts: previousParts,
        };
      }
  
      const body = new TextDecoder().decode(uint.subarray(0, contentLength));
      const nextBuffer = new TextDecoder().decode(uint.subarray(contentLength));
      const part = JSON.parse(body);
      const newParts = [...previousParts, part];
    
      if (nextBuffer.length) {
        return parseMultipartHttp(nextBuffer, boundary, newParts);
      }
      return { parts: newParts, newBuffer: '' };
    }

    class PatchResolver {
      constructor ({ onResponse, boundary }) {
        this.boundary = boundary || '-';
        this.onResponse = onResponse;
        this.processedChunks = 0;
        this.chunkBuffer = '';
      }

      handleChunk (data) {
        this.chunkBuffer += data;
        const { newBuffer, parts } = parseMultipartHttp(this.chunkBuffer, this.boundary);
        this.chunkBuffer = newBuffer;
        if (parts.length) {
          this.onResponse(parts);
        }
      }
    }

    const getBoundary = (contentType = '') => {
      const contentTypeParts = contentType.split(';');
      for (const contentTypePart of contentTypeParts) {
        const [key, value] = (contentTypePart || '').trim().split('=');
        if (key === 'boundary' && !!value) {
          if (value[0] === '"' && value[value.length - 1] === '"') {
            return value.substr(1, value.length - 2);
          }
          return value;
        }
      }
      return '-';
    }

    const fetchMultipart = (
      url,
      { method, headers, credentials, body, onNext, onError, onComplete }
    ) => {
      const controller = new AbortController();
      const signal = controller.signal;
      
      fetch(url, { method, headers, body, credentials, signal })
        .then((response) => {
          const contentType =
            (!!response.headers && response.headers.get("Content-Type")) || "";
          // @defer uses multipart responses to stream patches over HTTP
          if (
            response.status < 300 &&
            contentType.indexOf("multipart/mixed") >= 0
          ) {
            const boundary = getBoundary(contentType);
    
            // For the majority of browsers with support for ReadableStream and TextDecoder
            const reader = response.body.getReader();
            const textDecoder = new TextDecoder();
            const patchResolver = new PatchResolver({
              onResponse: (r) => {
                onNext(r)
              },
              boundary,
            });
            return reader.read().then(function sendNext({ value, done }) {
              if (!done) {
                let plaintext;
                try {
                  plaintext = textDecoder.decode(value);
                  // Read the header to get the Content-Length
                  patchResolver.handleChunk(plaintext);
                } catch (err) {
                  const parseError = err;
                  parseError.response = response;
                  parseError.statusCode = response.status;
                  parseError.bodyText = plaintext;
                  onError(parseError);
                }
                reader.read().then(sendNext);
              } else {
                onComplete();
              }
            });
          } else {
            return response.json().then((json) => {
              onNext([json]);
              onComplete();
            });
          }
        })
        .catch(onError);
      
      return {
        unsubscribe: () => controller.abort(),
      };
    }

    const fetcher = (graphQLParams) => {
      const operationAst = getOperationAST(parse(graphQLParams.query), graphQLParams.operationName);
      const isSubscription = operationAst && operationAst.operation === "subscription";
      if (isSubscription) {
        return {
          subscribe(opts) {
            const response = [];
            const onNext = opts.next;
            const onError = opts.error;
            const url = new URL("graphqlEndpoint", window.location.href)
            const searchParams = new URLSearchParams({ query: graphQLParams.query });

            if (graphQLParams.variables) {
              searchParams.set('variables', JSON.stringify(graphQLParams.variables))
            }

            if (graphQLParams.operationName) {
              searchParams.set('operationName', graphQLParams.operationName)
            }

            url.search = searchParams.toString()
            
            const eventSource = new EventSource(url.toString(), {
              withCredentials: true,
            });

            eventSource.addEventListener('message', (event) => {
              response.push(JSON.parse(event.data));
              onNext(response);
            });

            eventSource.addEventListener('error', () => {
              onError(new Error('EventSource error.'))
            });

            return {
              unsubscribe() {
                eventSource.close()
              }
            }
          }
        }
      }

      return {
        subscribe() {
          const isIntrospectionQuery = arguments.length === 3;
          const onNext = isIntrospectionQuery ? arguments[0] : arguments[0].next;
          const onError = isIntrospectionQuery ? arguments[1] : arguments[0].error;
          const onComplete = isIntrospectionQuery ? arguments[2] : arguments[0].complete;
          let response = {};
          return fetchMultipart(graphqlEndpoint, {
            body: JSON.stringify(graphQLParams),
            credentials: "include",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            method: "POST",
            onNext: (parts) => {
              let chunks = isIntrospectionQuery ? parts[0] : parts;
              
              if (!Array.isArray(chunks)) {
                chunks = [chunks]
              }

              chunks.forEach((chunk) => {
                console.log(chunk)
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
              })

              onNext(response)
            },
            onError,
            onComplete,
          })
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
