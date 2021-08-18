import copyToClipboard from "copy-to-clipboard";
import GraphiQL from "graphiql";
import { DocumentNode, getOperationAST, Kind, parse } from "graphql";
import React from "react";
import ReactDOM from "react-dom";

import {
  LoadFromUrlOptions,
  SubscriptionProtocol,
  UrlLoader,
} from "@graphql-tools/url-loader";
import {
  AsyncExecutor,
  ExecutionRequest,
  isAsyncIterable,
} from "@graphql-tools/utils";
import { isLiveQueryOperationDefinitionNode } from "@n1ru4l/graphql-live-query";

import { ToolbarDropDown } from "./drop-down";

import type { Fetcher } from "@graphiql/toolkit";

import type { HybridSubscriptionTransportConfig } from "../src/types";
export interface Options {
  defaultQuery?: string;
  defaultVariableEditorOpen?: boolean;
  endpoint?: string;
  headers?: string;
  headerEditorEnabled?: boolean;
  subscriptionsEndpoint?: string;
  subscriptionsProtocol?: `${SubscriptionProtocol}` | SubscriptionProtocol;
  hybridSubscriptionTransportConfig?: {
    default: keyof HybridSubscriptionTransportConfig;
    config: HybridSubscriptionTransportConfig;
  };
}

const buildHybridMenuOptions = (
  hybridConfig: HybridSubscriptionTransportConfig,
  endpoint: string
) => {
  const options: Array<{
    title: string;
    value: keyof HybridSubscriptionTransportConfig;
    url: string;
  }> = [];
  if (hybridConfig.sse) {
    options.push({
      value: "sse",
      title: "Subscriptions with SSE",
      url: typeof hybridConfig.sse === "string" ? hybridConfig.sse : endpoint,
    });
  }
  if (hybridConfig.transportWS) {
    options.push({
      value: "transportWS",
      title: "Subscriptions with GraphQL over WebSocket",
      url:
        typeof hybridConfig.transportWS === "string"
          ? hybridConfig.transportWS
          : getWebsocketSubscriptionsEndpointBasedOnEndpoint(endpoint),
    });
  }
  if (hybridConfig.legacyWS) {
    options.push({
      value: "legacyWS",
      title: "Subscriptions with GraphQL over WebSocket",
      url:
        typeof hybridConfig.legacyWS === "string"
          ? hybridConfig.legacyWS
          : getWebsocketSubscriptionsEndpointBasedOnEndpoint(endpoint),
    });
  }

  if (options.length === 0) {
    return null;
  }

  return options;
};

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

function getWebsocketSubscriptionsEndpointBasedOnEndpoint(endpoint: string) {
  const url = new URL(endpoint, window.location.href);
  url.protocol = url.protocol.replace("http", "ws");
  return url.href;
}

export const init = async ({
  defaultQuery,
  defaultVariableEditorOpen,
  endpoint = "/graphql",
  headers = "{}",
  headerEditorEnabled = true,
  subscriptionsEndpoint: optSubscriptionsEndpoint,
  subscriptionsProtocol: optSubscriptionProtocol,
  hybridSubscriptionTransportConfig,
}: Options = {}) => {
  const urlLoader = new UrlLoader();

  const menuOptions =
    hybridSubscriptionTransportConfig &&
    buildHybridMenuOptions(hybridSubscriptionTransportConfig.config, endpoint);
  let startHybridIndex: null | number = null;
  if (hybridSubscriptionTransportConfig && menuOptions) {
    startHybridIndex = menuOptions.findIndex(
      (option) => option.value === hybridSubscriptionTransportConfig.default
    );
    if (startHybridIndex === -1) {
      startHybridIndex = 0;
    }
  }

  let subscriptionsEndpoint: string =
    optSubscriptionsEndpoint ||
    (() => {
      if (
        optSubscriptionProtocol === undefined ||
        optSubscriptionProtocol === SubscriptionProtocol.SSE
      ) {
        return endpoint;
      }

      return getWebsocketSubscriptionsEndpointBasedOnEndpoint(endpoint);
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

      const [hybridTransportIndex, setHybridTransportIndex] =
        React.useState(startHybridIndex);
      const [networkInterface, setNetworkInterface] =
        React.useState<AsyncExecutor>(() => executor);

      React.useEffect(() => {
        let isCanceled = false;
        const options: LoadFromUrlOptions = {
          specifiedByUrl: true,
          directiveIsRepeatable: true,
          schemaDescription: true,
          subscriptionsEndpoint,
          subscriptionsProtocol,
          headers: JSON.parse(headers),
        };

        if (menuOptions && hybridTransportIndex) {
          const target = menuOptions[hybridTransportIndex];
          if (target.value === "sse") {
            options.subscriptionsProtocol = SubscriptionProtocol.SSE;
            options.subscriptionsEndpoint = target.url;
          } else if (target.value === "legacyWS") {
            options.subscriptionsProtocol = SubscriptionProtocol.LEGACY_WS;
            options.subscriptionsEndpoint = target.url;
          } else if (target.value === "transportWS") {
            options.subscriptionsProtocol = SubscriptionProtocol.WS;
            options.subscriptionsEndpoint = target.url;
          }
        }

        urlLoader
          .getExecutorAsync(endpoint, options)
          .then((networkInterface) => {
            if (isCanceled) {
              return;
            }
            setNetworkInterface(() => networkInterface);
          })
          .catch(console.error);

        return () => {
          isCanceled = true;
        };
      }, [menuOptions, hybridTransportIndex]);

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

      const fetcher = React.useMemo<Fetcher>(() => {
        return (graphQLParams, opts) => ({
          subscribe: (observerArg: any) => {
            const observer:
              | {
                  next: (value: unknown) => void;
                  error: (error: any) => void;
                  complete: () => void;
                  (value: unknown): void;
                }
              | {
                  next: (value: unknown) => void;
                  error: (error: any) => void;
                  complete: () => void;
                } = observerArg;

            let stopSubscription = () => {};
            Promise.resolve().then(async () => {
              try {
                const { document: filteredDocument } =
                  getOperationWithFragments(
                    parse(graphQLParams.query),
                    graphQLParams.operationName
                  );

                const operationAST = getOperationAST(filteredDocument);

                if (!operationAST)
                  throw Error("Invalid query document: " + graphQLParams.query);

                const executionParams: ExecutionRequest = {
                  document: filteredDocument,
                  variables: graphQLParams.variables,
                  context: {
                    headers: opts?.headers || {},
                  },
                  extensions: {
                    headers: opts?.headers || {},
                  },
                  operationType: operationAST.operation,
                };
                const queryFn = networkInterface;
                const res = await queryFn(executionParams);
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
        });
      }, [networkInterface]);

      return (
        <GraphiQL
          defaultQuery={defaultQuery}
          defaultVariableEditorOpen={defaultVariableEditorOpen}
          fetcher={fetcher}
          headers={headers}
          headerEditorEnabled={headerEditorEnabled}
          operationName={initialOperationName}
          query={initialQuery}
          ref={graphiqlRef}
          toolbar={{
            additionalContent: (
              <>
                <button className="toolbar-button" onClick={onShare}>
                  Share
                </button>
                {menuOptions && hybridTransportIndex != null && (
                  <ToolbarDropDown
                    options={menuOptions}
                    activeOptionIndex={hybridTransportIndex}
                    onSelectOption={(index) => {
                      setHybridTransportIndex(index);
                    }}
                  />
                )}
              </>
            ),
          }}
          variables={initialVariables}
        />
      );
    }, {}),
    document.body
  );
};
