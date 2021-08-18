export interface HybridSubscriptionTransportConfig {
  /* Enable SSE transport as an option, if set as "true", it re-uses `endpoint` */
  sse?: string | boolean;
  /* Enable Legacy graphql-ws protocol transport as an option, if set as "true", re-uses `endpoint` with "ws:" or "wss:" protocol */
  legacyWS?: string | boolean;
  /* Enable graphql-transport-ws protocol transport as an option, if set as "true" re-uses `endpoint` with "ws:" or "wss:" protocol */
  transportWS?: string | boolean;
}

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
   *
   * If no `subscriptionsEndpoint` is specified and `subscriptionsProtocol` is set to **"WS"** or **"LEGACY_WS"**,
   * it automatically reuses the `endpoint` with the current browser window URL with the protocol "ws://" or "wss://"
   */
  subscriptionsEndpoint?: string;
  /**
   * The Subscriptions protocol used.
   *
   * If no protocol is specified, it fallbacks to Server-Sent Events aka **"SSE"**
   */
  subscriptionsProtocol?: "WS" | "LEGACY_WS" | "SSE";

  /**
   * Enable selecting subscriptions protocol via dropdown in interface
   */
  hybridSubscriptionTransportConfig?: {
    default: keyof HybridSubscriptionTransportConfig;
    config: HybridSubscriptionTransportConfig;
  };
}
