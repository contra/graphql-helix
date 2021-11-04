import {
  execute as defaultExecute,
  getOperationAST,
  parse as defaultParse,
  subscribe as defaultSubscribe,
  validate as defaultValidate,
  DocumentNode,
  OperationDefinitionNode,
  ExecutionResult,
} from "https://cdn.skypack.dev/graphql@16.0.0-experimental-stream-defer.5?dts";
import { isAsyncIterable } from "./util/is-async-iterable.ts";
import { ExecutionContext, ExecutionPatchResult, ProcessRequestOptions } from "./types.ts";
import { getMultipartResponse, getPushResponse, getRegularResponse, getErrorResponse } from "./util/get-response.ts";

const parseQuery = async (query: string | DocumentNode, parse: typeof defaultParse): Promise<DocumentNode> => {
  if (typeof query !== "string" && query.kind === "Document") {
    return query;
  }
  return parse(query as string);
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
  TRootValue = {}
>(
  options: ProcessRequestOptions<TContext, TRootValue>
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

  const isEventStream = request.headers.get('accept') === "text/event-stream";

  try {
    if (request.method !== "GET" && request.method !== "POST") {
      return getErrorResponse({
        status: 405,
        message: "GraphQL only supports GET and POST requests.",
        headers: {
          Allow: "GET, POST",
        },
        transformResult,
        isEventStream,
      });
    }

    if (query == null) {
      return getErrorResponse({
        status: 400,
        message: "Must provide query string.",
        transformResult,
        isEventStream,
      });
    }

    try {
      document = await parseQuery(query, parse);
    } catch (e: any) {
      return getErrorResponse({
        status: 400,
        message: "Syntax error",
        errors: [e],
        transformResult,
        isEventStream,
      });
    }

    const validationErrors = validate(schema, document, validationRules);
    if (validationErrors.length > 0) {
      return getErrorResponse({
        status: 400,
        message: "Invalid query.",
        errors: validationErrors,
        transformResult,
        isEventStream,
      });
    }

    operation = getExecutableOperation(document, operationName);

    if (operation.operation === "mutation" && request.method === "GET") {
      return getErrorResponse({
        status: 405,
        message: "Can only perform a mutation operation from a POST request.",
        headers: {
          Allow: "POST",
        },
        transformResult,
        isEventStream,
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
        transformResult,
        isEventStream,
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
        return getPushResponse(result, transformResult);
      } else {
        if (isEventStream) {
          return getPushResponse(result, transformResult);
        } else {
          return getRegularResponse(result, transformResult);
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
          ? getPushResponse(result, transformResult)
          : getMultipartResponse(result, transformResult);
      } else {
        return getRegularResponse(result, transformResult);
      }
    }
  } catch (error: any) {
    const errors = Array.isArray(error) ? error : error.errors || [error];
    return getErrorResponse({ message: "Error", status: 500, errors, isEventStream, transformResult });
  }
};
