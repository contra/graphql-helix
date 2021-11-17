import copyToClipboard from "copy-to-clipboard";
import { DocumentNode, Kind, parse } from "graphql";
import GraphiQL, { Fetcher } from "graphiql";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { LoadFromUrlOptions, SubscriptionProtocol, UrlLoader } from "@graphql-tools/url-loader";
import { ToolbarDropDown } from "./drop-down";

export type HybridSubscriptionTransportConfig = {
  /* Enable SSE transport as an option */
  sse?: string;
  /* Enable Legacy graphql-ws protocol transport as an option. */
  legacyWS?: string;
  /* Enable graphql-transport-ws protocol transport as an option */
  transportWS?: string;
};
export interface Options {
  defaultQuery?: string;
  defaultVariableEditorOpen?: boolean;
  endpoint?: string;
  headers?: string;
  headerEditorEnabled?: boolean;
  subscriptionsEndpoint?: string;
  useWebSocketLegacyProtocol?: boolean;
  hybridSubscriptionTransportConfig?: {
    default: keyof HybridSubscriptionTransportConfig;
    config: HybridSubscriptionTransportConfig;
  };
  shouldPersistHeaders?: boolean;
}

const getOperationWithFragments = (document: DocumentNode, operationName: string): DocumentNode => {
  const definitions = document.definitions.filter((definition) => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      if (operationName) {
        if (definition.name?.value !== operationName) {
          return false;
        }
      }
    }
    return true;
  });
  return {
    kind: Kind.DOCUMENT,
    definitions,
  };
};

const buildHybridMenuOptions = (hybridConfig: HybridSubscriptionTransportConfig) => {
  const options: Array<{
    title: string;
    value: keyof HybridSubscriptionTransportConfig;
    url: string;
  }> = [];
  if (hybridConfig.sse) {
    options.push({
      value: "sse",
      title: "Subscriptions with SSE",
      url: hybridConfig.sse,
    });
  }
  if (hybridConfig.transportWS) {
    options.push({
      value: "transportWS",
      title: "Subscriptions with GraphQL over WebSocket",
      url: hybridConfig.transportWS,
    });
  }
  if (hybridConfig.legacyWS) {
    options.push({
      value: "legacyWS",
      title: "Subscriptions with GraphQL over WebSocket",
      url: hybridConfig.legacyWS,
    });
  }

  if (options.length === 0) {
    return null;
  }

  return options;
};

export const init = async ({
  defaultQuery,
  defaultVariableEditorOpen,
  endpoint = "/graphql",
  headers = "{}",
  headerEditorEnabled = true,
  subscriptionsEndpoint = endpoint,
  useWebSocketLegacyProtocol,
  hybridSubscriptionTransportConfig,
  shouldPersistHeaders,
}: Options = {}): Promise<void> => {
  const urlLoader = new UrlLoader();

  const searchParams = new URLSearchParams(window.location.search);
  const initialOperationName = searchParams.get("operationName") || undefined;
  const initialQuery = searchParams.get("query") || undefined;
  const initialVariables = searchParams.get("variables") || "{}";

  const menuOptions = hybridSubscriptionTransportConfig && buildHybridMenuOptions(hybridSubscriptionTransportConfig.config);
  let startHybridIndex: null | number = null;
  if (hybridSubscriptionTransportConfig && menuOptions) {
    startHybridIndex = menuOptions.findIndex((option) => option.value === hybridSubscriptionTransportConfig.default);
    if (startHybridIndex === -1) {
      startHybridIndex = 0;
    }
  }

  ReactDOM.render(
    React.createElement(() => {
      const graphiqlRef = React.useRef<GraphiQL | null>(null);

      const [hybridTransportIndex, setHybridTransportIndex] = React.useState(startHybridIndex);

      const fetcher: Fetcher = React.useMemo(() => {
        const options: LoadFromUrlOptions = {
          subscriptionsProtocol: subscriptionsEndpoint?.startsWith("ws")
            ? useWebSocketLegacyProtocol
              ? SubscriptionProtocol.LEGACY_WS
              : SubscriptionProtocol.WS
            : SubscriptionProtocol.SSE,
          specifiedByUrl: true,
          directiveIsRepeatable: true,
          schemaDescription: true,
          subscriptionsEndpoint,
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

        const executor$ = urlLoader.getExecutorAsync(endpoint, options);
        return async (graphQLParams, opts) => {
          const document = getOperationWithFragments(parse(graphQLParams.query), graphQLParams.operationName);

          const executor = await executor$;

          return executor({
            document,
            operationName: graphQLParams.operationName,
            variables: graphQLParams.variables,
            extensions: {
              headers: opts?.headers,
            },
          }) as ReturnType<Fetcher>;
        };
      }, [hybridTransportIndex]);

      const onShare = () => {
        const state = graphiqlRef.current?.state;

        copyToClipboard(
          urlLoader.prepareGETUrl({
            baseUrl: window.location.href,
            query: state?.query || "",
            variables: state?.variables,
            operationName: state?.operationName,
          })
        );
      };

      return fetcher ? (
        <GraphiQL
          defaultQuery={defaultQuery}
          defaultVariableEditorOpen={defaultVariableEditorOpen}
          fetcher={fetcher}
          headers={headers}
          headerEditorEnabled={headerEditorEnabled}
          operationName={initialOperationName}
          query={initialQuery}
          ref={graphiqlRef}
          shouldPersistHeaders={shouldPersistHeaders}
          toolbar={{
            additionalContent: (
              <>
                <button className="toolbar-button" onClick={onShare}>
                  Copy Link
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
      ) : null;
    }, {}),
    document.body
  );
};
