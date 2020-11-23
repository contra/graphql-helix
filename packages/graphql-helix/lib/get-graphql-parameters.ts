import { isHttpMethod } from "./util";
import { GraphQLParams, Request } from "./types";

export const getGraphQLParameters = (request: Request): GraphQLParams => {
  const { body, method, query: queryParams } = request;

  let operationName;
  let query;
  let variables;

  if (isHttpMethod("GET", method)) {
    operationName = queryParams.operationName;
    query = queryParams.query;
    variables = queryParams.variables;
  } else if (isHttpMethod("POST", method)) {
    operationName = body?.operationName;
    query = body?.query;
    variables = body?.variables;
  }

  return {
    operationName,
    query,
    variables,
  };
};
