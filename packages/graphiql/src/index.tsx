import { fetchEventSource } from "@microsoft/fetch-event-source";
import { isLiveQueryOperationDefinitionNode } from "@n1ru4l/graphql-live-query";
import {
  buildClientSchema,
  getIntrospectionQuery,
  getOperationAST,
  parse,
  GraphQLError,
  GraphQLSchema,
} from "graphql";
import GraphiQL from "graphiql";
import {
  Fetcher,
  FetcherOpts,
  FetcherParams,
} from "graphiql/dist/components/GraphiQL";
import { createClient as createWSClient } from "graphql-ws/lib/client";
import debounce from "lodash/debounce";
import merge from "lodash/merge";
import set from "lodash/set";
import { meros } from "meros/browser";
import React from "react";
import ReactDOM from "react-dom";

export interface Options {
  defaultQuery?: string;
  defaultVariableEditorOpen?: boolean;
  endpoint?: string;
  headers?: string;
  headerEditorEnabled?: boolean;
  subscriptionsEndpoint?: string;
}

interface ExecutionResult<
  TData = { [key: string]: any },
  TExtensions = { [key: string]: any }
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}

interface ExecutionPatchResult<
  TData = { [key: string]: any },
  TExtensions = { [key: string]: any }
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  hasNext: boolean;
  extensions?: TExtensions;
}

interface Sink<T = unknown> {
  next: (value: T) => void;
  error: (error: unknown) => void;
  complete: () => void;
}

const searchParams = new URLSearchParams(window.location.search);

const updateUrl = debounce(() => {
  history.replaceState(null, "", "?" + searchParams.toString());
}, 500);

const onEditOperationName = (operationName: string) => {
  searchParams.set("operationName", operationName);
  updateUrl();
};

const onEditQuery = (query?: string) => {
  searchParams.set("query", query || "");
  updateUrl();
};

const onEditVariables = (variables: string) => {
  searchParams.set("variables", variables);
  updateUrl();
};

const noop = () => undefined;

const isAsyncIterable = (input: unknown): input is AsyncIterable<unknown> => {
  return (
    typeof input === "object" && input != null && Symbol.asyncIterator in input
  );
};

const getSinkFromArguments = (args: IArguments): Sink => {
  if (typeof args[0] === "object") {
    return args[0];
  }
  return {
    next: () => args[0] || noop,
    complete: () => args[1] || noop,
    error: () => args[2] || noop,
  };
};

const subscribeWithMultipart = (
  url: string,
  sink: Sink,
  graphqlParams: FetcherParams,
  fetcherOptions?: FetcherOpts
) => {
  const controller = new AbortController();
  Promise.resolve().then(async () => {
    let response: ExecutionResult = {};

    const maybeStream = await fetch(url, {
      body: JSON.stringify(graphqlParams),
      credentials: "include",
      headers: {
        Accept: "application/json, multipart/mixed",
        "Content-Type": "application/json",
        ...(fetcherOptions?.headers || {}),
      },
      method: "POST",
      signal: controller.signal,
    }).then((response) => meros<ExecutionPatchResult>(response));

    try {
      if (isAsyncIterable(maybeStream)) {
        for await (const part of maybeStream) {
          if (part.json) {
            const chunk = part.body;
            if (chunk.path) {
              if (chunk.data) {
                const path: Array<string | number> = ["data"];
                merge(response, set({}, path.concat(chunk.path), chunk.data));
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
            sink.next(response);
          }
        }
      } else {
        sink.next(await maybeStream.json());
      }
    } catch (error) {
      if (typeof error.json === "function") {
        const response = await error.json();
        return sink.error(response);
      } else {
        sink.error(error);
      }
    }
    sink.complete();
  });

  return {
    unsubscribe() {
      controller.abort();
    },
  };
};

const subscribeWithEventSource = (
  baseUrl: string,
  sink: Sink,
  { query, operationName, variables }: FetcherParams,
  fetcherOptions?: FetcherOpts
) => {
  const controller = new AbortController();
  const url = new URL(baseUrl);
  const searchParams = new URLSearchParams();

  if (query) {
    searchParams.set("query", query);
  }
  if (operationName) {
    searchParams.set("operationName", operationName);
  }
  if (variables) {
    searchParams.set("variables", JSON.stringify(variables));
  }

  url.search = searchParams.toString();

  fetchEventSource(url.toString(), {
    credentials: "include",
    headers: fetcherOptions?.headers || {},
    method: "GET",
    onerror: (error) => {
      sink.error(error);
      throw error;
    },
    onmessage: (event) => {
      sink.next(JSON.parse(event.data || "{}"));
    },
    onopen: async (response) => {
      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("text/event-stream")) {
        let error;
        try {
          const { errors } = await response.json();
          error = errors[0];
        } catch (error) {
          // Failed to parse body
        }

        if (error) {
          throw error;
        }

        throw new Error(
          `Expected content-type to be ${"text/event-stream"} but got "${contentType}".`
        );
      }
    },
    signal: controller.signal,
  });

  return {
    unsubscribe() {
      controller.abort();
    },
  };
};

const subscribeWithWebSocket = (
  url: string,
  sink: Sink,
  { query, operationName, variables }: FetcherParams
) => {
  const client = createWSClient({ url });
  const unsubscribe = client.subscribe(
    {
      operationName,
      query,
      variables,
    },
    sink
  );
  return {
    unsubscribe() {
      unsubscribe();
      client.dispose();
    },
  };
};

export const init = async ({
  defaultQuery,
  defaultVariableEditorOpen,
  endpoint = "/graphql",
  headers = "{}",
  headerEditorEnabled = true,
  subscriptionsEndpoint,
}: Options = {}) => {
  const subscriptionsEndpointOrDefault = subscriptionsEndpoint || endpoint;
  const isWebSocket =
    subscriptionsEndpointOrDefault.startsWith("ws://") ||
    subscriptionsEndpointOrDefault.startsWith("wss://");

  const fetcher: Fetcher = (graphqlParams, fetcherOptions) => {
    const operationAst = getOperationAST(
      parse(graphqlParams.query),
      graphqlParams.operationName
    );
    const isLiveQuery =
      operationAst && isLiveQueryOperationDefinitionNode(operationAst);
    const isSubscription =
      operationAst && operationAst.operation === "subscription";

    return {
      subscribe() {
        const sink = getSinkFromArguments(arguments);
        return isSubscription || isLiveQuery
          ? isWebSocket
            ? subscribeWithWebSocket(
                subscriptionsEndpointOrDefault,
                sink,
                graphqlParams
              )
            : subscribeWithEventSource(
                subscriptionsEndpointOrDefault,
                sink,
                graphqlParams,
                fetcherOptions
              )
          : subscribeWithMultipart(
              endpoint,
              sink,
              graphqlParams,
              fetcherOptions
            );
      },
    };
  };

  let schema: GraphQLSchema | undefined = undefined;
  try {
    const introspectionResponse = await fetch(endpoint, {
      body: JSON.stringify({
        query: getIntrospectionQuery({
          specifiedByUrl: true,
          directiveIsRepeatable: true,
          schemaDescription: true,
        }),
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const { data: introspectionResult } = await introspectionResponse.json();
    schema = buildClientSchema(introspectionResult);
  } catch (error) {
    console.error(error);
  }

  ReactDOM.render(
    React.createElement(() => {
      return (
        <GraphiQL
          defaultQuery={defaultQuery}
          defaultVariableEditorOpen={defaultVariableEditorOpen}
          fetcher={fetcher}
          headers={headers}
          headerEditorEnabled={headerEditorEnabled}
          onEditOperationName={onEditOperationName}
          onEditQuery={onEditQuery}
          onEditVariables={onEditVariables}
          query={searchParams.get("query") || undefined}
          schema={schema}
          variables="{}"
        />
      );
    }, {}),
    document.body
  );
};
