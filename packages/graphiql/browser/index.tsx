import copyToClipboard from "copy-to-clipboard";
import GraphiQL from "graphiql";
import { DocumentNode, getOperationAST, Kind, parse } from "graphql";
import React from "react";
import ReactDOM from "react-dom";

import { SubscriptionProtocol, UrlLoader } from "@graphql-tools/url-loader";
import { isAsyncIterable } from "@graphql-tools/utils";
import { isLiveQueryOperationDefinitionNode } from "@n1ru4l/graphql-live-query";

export interface Options {
  defaultQuery?: string;
  defaultVariableEditorOpen?: boolean;
  endpoint?: string;
  headers?: string;
  headerEditorEnabled?: boolean;
  subscriptionsEndpoint?: string;
  subscriptionsProtocol?: `${SubscriptionProtocol}` | SubscriptionProtocol;
}

const getOperationWithFragments = (
  document: DocumentNode,
  operationName: string
): {
  document: DocumentNode;
  isSubscriber: boolean;
} => {
  let isSubscriber = false;
  const definitions = document.definitions.filter((definition) => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      if (operationName) {
        if (definition.name?.value !== operationName) {
          return false;
        }
      }
      if (
        definition.operation === "subscription" ||
        isLiveQueryOperationDefinitionNode(definition)
      ) {
        isSubscriber = true;
      }
    }
    return true;
  });
  return {
    document: {
      kind: Kind.DOCUMENT,
      definitions,
    },
    isSubscriber,
  };
};

export const init = async ({
  defaultQuery,
  defaultVariableEditorOpen,
  endpoint = "/graphql",
  headers = "{}",
  headerEditorEnabled = true,
  subscriptionsEndpoint: optSubscriptionsEndpoint,
  subscriptionsProtocol: optSubscriptionProtocol,
}: Options = {}) => {
  const urlLoader = new UrlLoader();

  let subscriptionsEndpoint: string =
    optSubscriptionsEndpoint ||
    (() => {
      if (
        optSubscriptionProtocol === undefined ||
        optSubscriptionProtocol === SubscriptionProtocol.SSE
      ) {
        return endpoint;
      }

      const url = new URL(endpoint, window.location.href);
      url.protocol = url.protocol.replace("http", "ws");
      return url.href;
    })();

  const subscriptionsProtocol: SubscriptionProtocol =
    (optSubscriptionProtocol as SubscriptionProtocol) ||
    (subscriptionsEndpoint.startsWith("ws://") ||
    subscriptionsEndpoint.startsWith("wss://")
      ? SubscriptionProtocol.WS
      : SubscriptionProtocol.SSE);

  const executor = await urlLoader.getExecutorAsync(endpoint, {
    specifiedByUrl: true,
    directiveIsRepeatable: true,
    schemaDescription: true,
    subscriptionsEndpoint,
    subscriptionsProtocol,
    headers: JSON.parse(headers),
  });

  const searchParams = new URLSearchParams(window.location.search);
  const initialOperationName = searchParams.get("operationName") || undefined;
  const initialQuery = searchParams.get("query") || undefined;
  const initialVariables = searchParams.get("variables") || "{}";

  ReactDOM.render(
    React.createElement(() => {
      const graphiqlRef = React.useRef<GraphiQL | null>(null);

      const onShare = () => {
        const state = graphiqlRef.current?.state;

        console.log({
          a: state?.query,
          b: state?.variables,
          c: state?.operationName,
        });

        copyToClipboard(
          urlLoader.prepareGETUrl({
            baseUrl: window.location.href,
            query: state?.query || "",
            variables: state?.variables && JSON.parse(state.variables),
            operationName: state?.operationName,
          })
        );
      };

      return (
        <GraphiQL
          defaultQuery={defaultQuery}
          defaultVariableEditorOpen={defaultVariableEditorOpen}
          fetcher={(graphQLParams, opts) => ({
            subscribe: (observer: any) => {
              let stopSubscription = () => {};
              Promise.resolve().then(async () => {
                try {
                  const { document: filteredDocument } =
                    getOperationWithFragments(
                      parse(graphQLParams.query),
                      graphQLParams.operationName
                    );
                  const executionParams = {
                    document: filteredDocument,
                    variables: graphQLParams.variables,
                    context: {
                      headers: opts?.headers || {},
                    },
                  };

                  const operationAST = getOperationAST(filteredDocument);

                  if (!operationAST)
                    throw Error(
                      "Invalid query document: " + graphQLParams.query
                    );

                  const res = await executor({
                    ...executionParams,
                    operationType: operationAST.operation,
                    extensions: {
                      headers: opts?.headers || {},
                    },
                  });
                  if (isAsyncIterable(res)) {
                    const asyncIterable = res[Symbol.asyncIterator]();
                    if (asyncIterable.return) {
                      stopSubscription = () => {
                        asyncIterable.return!();
                        observer.complete();
                      };
                    }
                    for await (const part of res) {
                      observer.next(part);
                    }
                    observer.complete();
                  } else if (typeof observer === "function") {
                    observer(res);
                  } else {
                    observer.next(res);
                    observer.complete();
                  }
                } catch (error: any) {
                  let errorResult: any;
                  if (typeof error.json === "function") {
                    errorResult = await error.json();
                  } else {
                    errorResult = error;
                  }
                  if (typeof observer === "function") {
                    throw errorResult;
                  } else {
                    observer.error(errorResult);
                  }
                }
              });
              return { unsubscribe: () => stopSubscription() };
            },
          })}
          headers={headers}
          headerEditorEnabled={headerEditorEnabled}
          operationName={initialOperationName}
          query={initialQuery}
          ref={graphiqlRef}
          toolbar={{
            additionalContent: (
              <button className="toolbar-button" onClick={onShare}>
                Share
              </button>
            ),
          }}
          variables={initialVariables}
        />
      );
    }, {}),
    document.body
  );
};