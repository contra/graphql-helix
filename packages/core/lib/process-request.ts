import {
  execute as defaultExecute,
  getOperationAST,
  parse as defaultParse,
  subscribe as defaultSubscribe,
  validate as defaultValidate,
  DocumentNode,
  GraphQLError,
  GraphQLSchema,
  OperationDefinitionNode,
  ValidationRule,
  ExecutionResult,
} from "graphql";
import { stopAsyncIteration, isAsyncIterable, isHttpMethod } from "./util/index";
import { HttpError } from "./errors";
import {
  ExecutionContext,
  ExecutionPatchResult,
  MultipartResponse,
  ProcessRequestOptions,
  ProcessRequestResult,
  Request,
} from "./types";
import { getRankedResponseProtocols, RankedResponseProtocols } from "./util/get-ranked-response-protocols";

const parseQuery = (query: string | DocumentNode, parse: typeof defaultParse): DocumentNode | Promise<DocumentNode> => {
  if (typeof query !== "string" && query.kind === "Document") {
    return query;
  }
  try {
    const parseResult = parse(query as string);

    if (parseResult instanceof Promise) {
      return parseResult.catch((syntaxError) => {
        throw new HttpError(400, "GraphQL syntax error.", {
          graphqlErrors: [syntaxError],
        });
      });
    }
    return parseResult;
  } catch (syntaxError) {
    throw new HttpError(400, "GraphQL syntax error.", {
      graphqlErrors: [syntaxError as GraphQLError],
    });
  }
};

export const validateDocument = (
  schema: GraphQLSchema,
  document: DocumentNode,
  validate: typeof defaultValidate,
  validationRules?: readonly ValidationRule[]
): void => {
  const validationErrors = validate(schema, document, validationRules);
  if (validationErrors.length) {
    throw new HttpError(400, "GraphQL validation error.", {
      graphqlErrors: validationErrors,
    });
  }
};

const getExecutableOperation = (document: DocumentNode, operationName?: string): OperationDefinitionNode => {
  const operation = getOperationAST(document, operationName);

  if (!operation) {
    throw new HttpError(400, "Could not determine what operation to execute.");
  }

  return operation;
};

// If clients do not accept application/graphql+json use application/json - otherwise respect the order in the accept header
const getSingleResponseContentType = (protocols: RankedResponseProtocols): "application/graphql+json" | "application/json" => {
  if (protocols["application/graphql+json"] === -1) {
    return "application/json";
  }
  return protocols["application/graphql+json"] > protocols["application/json"] ? "application/graphql+json" : "application/json";
};

const getHeader = (request: Request, headerName: string): unknown =>
  typeof request.headers.get === "function" ? request.headers.get(headerName) : (request.headers as any)[headerName];

export const processRequest = async <TContext = {}, TRootValue = {}>(
  options: ProcessRequestOptions<TContext, TRootValue>
): Promise<ProcessRequestResult<TContext, TRootValue>> => {
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
    allowedSubscriptionHttpMethods = ["GET"],
  } = options;

  let context: TContext | undefined;
  let rootValue: TRootValue | undefined;
  let document: DocumentNode | undefined;
  let operation: OperationDefinitionNode | undefined;

  const result = await (async (): Promise<ProcessRequestResult<TContext, TRootValue>> => {
    const accept: unknown = getHeader(request, "accept");
    const contentType: unknown = getHeader(request, "contentType");

    const rankedProtocols = getRankedResponseProtocols(accept, contentType);

    const isEventStreamAccepted = rankedProtocols["text/event-stream"] !== -1;

    const defaultSingleResponseHeaders = [
      {
        name: "Content-Type",
        value: getSingleResponseContentType(rankedProtocols),
      },
    ];

    try {
      if (!isHttpMethod("GET", request.method) && !isHttpMethod("POST", request.method)) {
        throw new HttpError(405, "GraphQL only supports GET and POST requests.", {
          headers: [...defaultSingleResponseHeaders, { name: "Allow", value: "GET, POST" }],
        });
      }

      if (query == null) {
        throw new HttpError(400, "Must provide query string.", { headers: defaultSingleResponseHeaders });
      }

      document = await parseQuery(query, parse);

      validateDocument(schema, document, validate, validationRules);

      operation = getExecutableOperation(document, operationName);

      if (operation.operation === "mutation" && isHttpMethod("GET", request.method)) {
        throw new HttpError(405, "Can only perform a mutation operation from a POST request.", {
          headers: [...defaultSingleResponseHeaders, { name: "Allow", value: "POST" }],
        });
      }

      let variableValues: { [name: string]: any } | undefined;

      try {
        if (variables) {
          variableValues = typeof variables === "string" ? JSON.parse(variables) : variables;
        }
      } catch (_error) {
        throw new HttpError(400, "Variables are invalid JSON.", {
          headers: defaultSingleResponseHeaders,
        });
      }

      try {
        const executionContext: ExecutionContext = {
          request,
          document,
          operation,
          variables: variableValues,
        };
        context = contextFactory ? await contextFactory(executionContext) : ({} as TContext);
        rootValue = rootValueFactory ? await rootValueFactory(executionContext) : ({} as TRootValue);

        if (operation.operation === "subscription") {
          if (!allowedSubscriptionHttpMethods.some((method) => isHttpMethod(method, request.method))) {
            throw new HttpError(
              405,
              `Can only perform subscription operation from a ${allowedSubscriptionHttpMethods.join(" or ")} request.`,
              {
                headers: [
                  ...defaultSingleResponseHeaders,
                  {
                    name: "Allow",
                    value: allowedSubscriptionHttpMethods.join(", "),
                  },
                ],
              }
            );
          }
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
          if (isAsyncIterable<ExecutionResult>(result)) {
            return {
              type: "PUSH",
              subscribe: async (onResult) => {
                try {
                  for await (const payload of result) {
                    onResult(
                      formatPayload({
                        payload,
                        context,
                        rootValue,
                        document,
                        operation,
                      })
                    );
                  }
                } catch (error) {
                  const payload: ExecutionResult<any> = {
                    errors: ((error as HttpError).graphqlErrors as GraphQLError[]) || [
                      new GraphQLError((error as Error).message),
                    ],
                  };

                  onResult(
                    formatPayload({
                      payload,
                      context,
                      rootValue,
                      document,
                      operation,
                    })
                  );
                  stopAsyncIteration(result);
                }
              },
              unsubscribe: () => {
                stopAsyncIteration(result);
              },
            };
          }
          return {
            type: "PUSH",
            subscribe: async (onResult) => {
              onResult(
                formatPayload({
                  payload: result,
                  context,
                  rootValue,
                  document,
                  operation,
                })
              );
            },
            unsubscribe: () => undefined,
          };
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
            return {
              type: isHttpMethod("GET", request.method) ? "PUSH" : "MULTIPART_RESPONSE",
              subscribe: async (onResult) => {
                for await (const payload of result) {
                  onResult(
                    formatPayload({
                      payload,
                      context,
                      rootValue,
                      document,
                      operation,
                    })
                  );
                }
              },
              unsubscribe: () => {
                stopAsyncIteration(result);
              },
            } as MultipartResponse<TContext, TRootValue>;
          } else {
            return {
              type: "RESPONSE",
              status: 200,
              headers: defaultSingleResponseHeaders,
              payload: formatPayload({
                payload: result,
                context,
                rootValue,
                document,
                operation,
              }),
            };
          }
        }
      } catch (executionError) {
        if (executionError instanceof GraphQLError) {
          throw new HttpError(200, "GraphQLError encountered white executed GraphQL request.", {
            graphqlErrors: [executionError],
            headers: defaultSingleResponseHeaders,
          });
        } else if (executionError instanceof HttpError) {
          throw executionError;
        } else {
          throw new HttpError(500, "Unexpected error encountered while executing GraphQL request.", {
            graphqlErrors: [new GraphQLError((executionError as Error).message)],
            headers: defaultSingleResponseHeaders,
          });
        }
      }
    } catch (error) {
      const payload: ExecutionResult<any> = {
        errors: ((error as HttpError).graphqlErrors as GraphQLError[]) || [new GraphQLError((error as Error).message)],
      };

      if (isEventStreamAccepted) {
        return {
          type: "PUSH",
          subscribe: async (onResult) => {
            onResult(
              formatPayload({
                payload,
                context,
                rootValue,
                document,
                operation,
              })
            );
          },
          unsubscribe: () => undefined,
        };
      } else {
        return {
          type: "RESPONSE",
          status: (error as HttpError).status || 500,
          headers: (error as HttpError).headers || [],
          payload: formatPayload({
            payload,
            context,
            rootValue,
            document,
            operation,
          }),
        };
      }
    }
  })();

  return {
    ...result,
    context,
    rootValue,
    document,
    operation,
  };
};
