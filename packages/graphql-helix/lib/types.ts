export type HybridSubscriptionTransportConfig = {
  /* Enable SSE transport as an option */
  sse?: string;
  /* Enable Legacy graphql-ws protocol transport as an option. */
  legacyWS?: string;
  /* Enable graphql-transport-ws protocol transport as an option */
  transportWS?: string;
};

export interface RenderGraphiQLOptions {
  /**
   * An optional GraphQL string to use when no query is provided and no stored
   * query exists from a previous session.  If undefined is provided, GraphiQL
   * will use its own default query.
   */
  defaultQuery?: string;
  /**
   * Whether to open the variable editor by default. Defaults to `true`.
   */
  defaultVariableEditorOpen?: boolean;
  /**
   * The endpoint requests should be sent. Defaults to `"/graphql"`.
   */
  endpoint?: string;
  /**
   * The initial headers to render inside the header editor. Defaults to `"{}"`.
   */
  headers?: string;
  /**
   * Whether the header editor is enabled. Defaults to `true`.
   */
  headerEditorEnabled?: boolean;
  /**
   * A cryptographic nonce for use with Content-Security-Policy.
   */
  nonce?: string;
  /**
   * The endpoint subscription requests should be sent to. Defaults to the value of the `endpoint` parameter.
   */
  subscriptionsEndpoint?: string;
  /**
   * Use legacy web socket protocol `graphql-ws` instead of the more current standard `graphql-transport-ws`
   */
  useWebSocketLegacyProtocol?: boolean;
  hybridSubscriptionTransportConfig?: HybridSubscriptionTransportConfig;
}
