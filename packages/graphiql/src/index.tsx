import { isLiveQueryOperationDefinitionNode } from "@n1ru4l/graphql-live-query";
import copyToClipboard from "copy-to-clipboard";
import { getOperationAST, parse, print } from "graphql";
import GraphiQL from "graphiql";
import React from "react";
import ReactDOM from "react-dom";
import { UrlLoader, LoadFromUrlOptions } from "@graphql-tools/url-loader";

export type Options = Omit<LoadFromUrlOptions, "headers"> & {
  defaultQuery?: string;
  defaultVariableEditorOpen?: boolean;
  endpoint?: string;
  headers?: string;
  headerEditorEnabled?: boolean;
  subscriptionsEndpoint?: string;
};

const isAsyncIterable = (input: unknown): input is AsyncIterable<unknown> => {
  return (
    typeof input === "object" && input != null && Symbol.asyncIterator in input
  );
};

const buildGraphQLUrl = (
  baseUrl: string,
  query: string | undefined,
  variables: string | object | undefined,
  operationName: string | undefined
): string => {
  const searchParams = new URLSearchParams();

  if (query) {
    searchParams.set("query", query);
  }
  if (operationName) {
    searchParams.set("operationName", operationName);
  }
  if (variables) {
    searchParams.set(
      "variables",
      typeof variables === "object" ? JSON.stringify(variables) : variables
    );
  }

  return `${baseUrl}?${searchParams.toString()}`;
};

export const init = async ({
  defaultQuery,
  defaultVariableEditorOpen,
  endpoint = "/graphql",
  headers = "{}",
  headerEditorEnabled = true,
  ...options
}: Options = {}) => {
  const urlLoader = new UrlLoader();
  const {
    schema,
    executor,
    subscriber,
  } = await urlLoader.getSubschemaConfigAsync(endpoint, {
    useSSEForSubscription: !options?.subscriptionsEndpoint?.startsWith("ws"),
    specifiedByUrl: true,
    directiveIsRepeatable: true,
    schemaDescription: true,
    ...options,
    headers: (executionParams) => executionParams?.context?.headers || {},
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
          buildGraphQLUrl(
            window.location.href,
            state?.query,
            state?.variables,
            state?.operationName
          )
        );
      };

      return (
        <GraphiQL
          defaultQuery={defaultQuery}
          defaultVariableEditorOpen={defaultVariableEditorOpen}
          fetcher={(graphQLParams, opts) => {
            return {
              subscribe(sink) {
                let unsubscribe = () => {};
                Promise.resolve().then(async () => {
                  try {
                    const operationAst = getOperationAST(
                      parse(graphQLParams.query),
                      graphQLParams.operationName
                    )!;
                    const isLiveQuery = isLiveQueryOperationDefinitionNode(
                      operationAst
                    );
                    const isSubscription =
                      operationAst.operation === "subscription";
                    const executionParams: Parameters<typeof subscriber>[0] = {
                      document: parse(print(operationAst!)),
                      variables: graphQLParams.variables,
                      context: {
                        headers: opts?.headers,
                      },
                    };
                    const queryFn: any =
                      isSubscription || isLiveQuery ? subscriber : executor;
                    const res = await queryFn(executionParams);
                    if (isAsyncIterable(res)) {
                      if ("return" in res) {
                        unsubscribe = res!.return!.bind(res);
                      }
                      for await (const part of res) {
                        sink.next(part);
                      }
                      sink.complete();
                    } else {
                      sink.next(res);
                      sink.complete();
                    }
                  } catch (error) {
                    if (typeof error.json === "function") {
                      const errRes = await error.json();
                      sink.error(errRes);
                    } else {
                      sink.error(error);
                    }
                  }
                });
                return { unsubscribe };
              },
            };
          }}
          headers={headers}
          headerEditorEnabled={headerEditorEnabled}
          operationName={initialOperationName}
          query={initialQuery}
          ref={graphiqlRef}
          schema={schema}
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
