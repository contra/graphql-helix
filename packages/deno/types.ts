import {
  DocumentNode,
  ExecutionPatchResult,
  ExecutionResult,
  GraphQLSchema,
  OperationDefinitionNode,
  ValidationRule,
} from "https://cdn.skypack.dev/graphql@15.4.0-experimental-stream-defer.1?dts";

export interface GraphQLParams {
  operationName?: string;
  query?: string;
  variables?: string | { [name: string]: any };
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
   * The endpoint subscription requests should be sent to. Defaults to the value of the `endpoint` parameter.
   */
  subscriptionsEndpoint?: string;
}

export interface ProcessRequestOptions {
  /**
   * A function whose return value is passed in as the `context` to `execute`.
   */
  contextFactory?: (
    executionContext: ExecutionContext
  ) => Promise<unknown> | unknown;
  /**
   * An optional function which will be used to execute instead of default `execute` from `graphql-js`.
   */
  execute?: (...args: any[]) => any;
  /**
   * The name of the Operation in the Document to execute.
   */
  operationName?: string;
  /**
   * An optional function which will be used to create a document instead of the default `parse` from `graphql-js`.
   */
  parse?: (...args: any[]) => any;
  /**
   * A Document containing GraphQL Operations and Fragments to execute.
   */
  query?: string | DocumentNode;
  /**
   * An object describing the HTTP request.
   */
  request: Request;
  /**
   * A function whose return value is passed in as the `rootValue` to `execute`.
   */
  rootValueFactory?: (
    executionContext: ExecutionContext
  ) => Promise<unknown> | unknown;
  /**
   * The GraphQL schema used to process the request.
   */
  schema: GraphQLSchema;
  /**
   * An optional function which will be used to subscribe instead of default `subscribe` from `graphql-js`.
   */
  subscribe?: (...args: any[]) => any;
  /**
   * An optional function which will be used to validate instead of default `validate` from `graphql-js`.
   */
  validate?: (...args: any[]) => any;
  /**
   * An optional array of validation rules that will be applied to the document
   * in place of those defined by the GraphQL specification.
   */
  validationRules?: ReadonlyArray<ValidationRule>;
  /**
   * Values for any Variables defined by the Operation.
   */
  variables?: string | { [name: string]: any };
}

export interface ExecutionContext {
  document: DocumentNode;
  operation: OperationDefinitionNode;
  variables?: { readonly [name: string]: unknown };
}

export interface Request {
  body?: any;
  headers: Headers;
  method: string;
  query: any;
}

export type Headers =
  | Record<string, string | string[] | undefined>
  | { get(name: string): string | null };

export interface Response {
  type: "RESPONSE";
  status: number;
  headers: { name: string; value: string }[];
  payload: ExecutionResult;
}

export interface MultipartResponse {
  type: "MULTIPART_RESPONSE";
  subscribe: (
    onResult: (result: ExecutionPatchResult) => void
  ) => Promise<void>;
  unsubscribe: () => void;
}

export interface Push {
  type: "PUSH";
  subscribe: (onResult: (result: ExecutionResult) => void) => Promise<void>;
  unsubscribe: () => void;
}

export type ProcessRequestResult = Response | MultipartResponse | Push;
