import {
  execute as defaultExecute,
  getOperationAST,
  parse as defaultParse,
  subscribe as defaultSubscribe,
  validate as defaultValidate,
  DocumentNode,
  GraphQLSchema,
  OperationDefinitionNode,
  ValidationRule,
  ExecutionResult,
} from "graphql";
import { isAsyncIterable } from "./util/index";
import { ExecutionContext, ExecutionPatchResult, ProcessRequestOptions } from "./types";
import { getMultipartResponse, getPushResponse, getRegularResponse, getErrorResponse } from "./util/w3c";

const parseQuery = async (query: string | DocumentNode, parse: typeof defaultParse): Promise<DocumentNode> => {
  if (typeof query !== "string" && query.kind === "Document") {
    return query;
  }
  return parse(query as string);
};

export const validateDocument = (
  schema: GraphQLSchema,
  document: DocumentNode,
  validate: typeof defaultValidate,
  validationRules?: readonly ValidationRule[]
): void => {
  const validationErrors = validate(schema, document, validationRules);
  if (validationErrors.length) {
    throw validationErrors;
  }
};

const getExecutableOperation = (document: DocumentNode, operationName?: string): OperationDefinitionNode => {
  const operation = getOperationAST(document, operationName);

  if (!operation) {
    throw new Error("Could not determine what operation to execute.");
  }

  return operation;
};

export const processRequest = async <
  TContext = {},
  TRootValue = {},
  TResponse extends Response = Response,
  TReadableStream extends ReadableStream = ReadableStream,
>(
  options: ProcessRequestOptions<TContext, TRootValue, TResponse, TReadableStream>
): Promise<Response> => {
  const {
    contextFactory,
    execute = defaultExecute,
    formatPayload = ({ payload }) => payload,
    operationName,
    parse = defaultParse,
    query,
    request,
    rootValueFactory,
    schema,
    subscribe = defaultSubscribe,
    validate = defaultValidate,
    validationRules,
    variables,
    Response,
    ReadableStream,
  } = options;

  const transformResult = (payload: ExecutionResult | ExecutionPatchResult) =>
    formatPayload({
      payload,
      context,
      rootValue,
      document,
      operation,
    });

  let context: TContext | undefined;
  let rootValue: TRootValue | undefined;
  let document: DocumentNode | undefined;
  let operation: OperationDefinitionNode | undefined;

  const accept = typeof request.headers.get === "function" ? request.headers.get("accept") : (request.headers as any).accept;
  const isEventStream = accept === "text/event-stream";

  try {
    if (request.method !== "GET" && request.method !== "POST") {
      return getErrorResponse({
        status: 405,
        message: "GraphQL only supports GET and POST requests.",
        headers: {
          Allow: "GET, POST",
        },
        Response, transformResult,
      });
    }

    if (query == null) {
      return getErrorResponse({
        status: 400,
        message: "Must provide query string.",
        Response, transformResult,
      });
    }

    document = await parseQuery(query, parse);

    validateDocument(schema, document, validate, validationRules);

    operation = getExecutableOperation(document, operationName);

    if (operation.operation === "mutation" && request.method === "GET") {
      return getErrorResponse({
        status: 405,
        message: "Must provide query string.",
        headers: {
          Allow: "POST",
        },
        Response, transformResult,
      });
    }

    let variableValues: { [name: string]: any } | undefined;

    try {
      if (variables) {
        variableValues = typeof variables === "string" ? JSON.parse(variables) : variables;
      }
    } catch (_error) {
      return getErrorResponse({
        message: "Variables are invalid JSON.",
        status: 400,
        Response, transformResult
      });
    }

    const executionContext: ExecutionContext = {
      request,
      document,
      operation,
      variables: variableValues,
    };
    context = contextFactory ? await contextFactory(executionContext) : ({} as TContext);
    rootValue = rootValueFactory ? await rootValueFactory(executionContext) : ({} as TRootValue);

    if (operation.operation === "subscription") {
      const result = await subscribe({
        schema,
        document,
        rootValue,
        contextValue: context,
        variableValues,
        operationName,
      });

      // If errors are encountered while subscribing to the operation, an execution result
      // instead of an AsyncIterable.
      if (isAsyncIterable<ExecutionPatchResult>(result)) {
        return getPushResponse({ asyncExecutionResult: result, Response, ReadableStream, transformResult });
      } else {
        if (isEventStream) {
          return getPushResponse({ asyncExecutionResult: result, Response, ReadableStream, transformResult });
        } else {
          return getRegularResponse({ executionResult: result, Response, transformResult });
        }
      }
    } else {
      const result = await execute({
        schema,
        document,
        rootValue,
        contextValue: context,
        variableValues,
        operationName,
      });

      // Operations that use @defer, @stream and @live will return an `AsyncIterable` instead of an
      // execution result.
      if (isAsyncIterable<ExecutionPatchResult>(result)) {
        return isEventStream
          ? getPushResponse({ asyncExecutionResult: result, Response, ReadableStream, transformResult })
          : getMultipartResponse({ asyncExecutionResult: result, Response, ReadableStream, transformResult });
      } else {
        return getRegularResponse({ executionResult: result, Response });
      }
    }
  } catch (error: any) {
    const errors = Array.isArray(error) ? error : error.errors || [error];
    const payload: ExecutionResult<any> = {
      errors,
    };

    return getRegularResponse({ executionResult: payload, Response, transformResult });
  }
};
