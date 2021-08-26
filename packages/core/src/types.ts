import type {
  DocumentNode,
  ExecutionResult,
  GraphQLError,
  GraphQLSchema,
  OperationDefinitionNode,
  ValidationRule,
} from "graphql";

export interface ExecutionPatchResult<
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

export interface GraphQLParams {
  operationName?: string;
  query?: string;
  variables?: string | { [name: string]: any };
  extensions?: string | Record<string, unknown>;
}

export interface ProcessRequestOptions<TContext, TRootValue> {
  /**
   * A function whose return value is passed in as the `context` to `execute`.
   */
  contextFactory?: (
    executionContext: ExecutionContext
  ) => Promise<TContext> | TContext;
  /**
   * An optional function which will be used to execute instead of default `execute` from `graphql-js`.
   */
  execute?: (...args: any[]) => any;
  /**
   * An optional function that can be used to transform every payload (i.e. the `data` object and `errors` array) that's
   * emitted by `processRequest`.
   */
  formatPayload?: (params: FormatPayloadParams<TContext, TRootValue>) => any;
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
  ) => Promise<TRootValue> | TRootValue;
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
  /**
   * Extensions specified in request
   */
  extensions?: string | Record<string, unknown>;
}

export interface FormatPayloadParams<TContext, TRootValue> {
  payload: ExecutionResult | ExecutionPatchResult;
  contextValue?: TContext;
  document?: DocumentNode;
  operation?: OperationDefinitionNode;
  rootValue?: TRootValue;
}

export interface ExecutionContext {
  request: Request;
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

export interface Result<TContext, TRootValue> {
  contextValue?: TContext;
  document?: DocumentNode;
  operation?: OperationDefinitionNode;
  rootValue?: TRootValue;
}

export interface Response<TContext, TRootValue>
  extends Result<TContext, TRootValue> {
  type: "RESPONSE";
  status: number;
  headers: { name: string; value: string }[];
  payload: ExecutionResult;
}

export interface MultipartResponse<TContext, TRootValue>
  extends Result<TContext, TRootValue> {
  type: "MULTIPART_RESPONSE";
  subscribe: (
    onResult: (result: ExecutionPatchResult) => void
  ) => Promise<void>;
  unsubscribe: () => void;
}

export interface Push<TContext, TRootValue>
  extends Result<TContext, TRootValue> {
  type: "PUSH";
  subscribe: (onResult: (result: ExecutionResult) => void) => Promise<void>;
  unsubscribe: () => void;
}

export type ProcessRequestResult<TContext, TRootValue> =
  | Response<TContext, TRootValue>
  | MultipartResponse<TContext, TRootValue>
  | Push<TContext, TRootValue>;
