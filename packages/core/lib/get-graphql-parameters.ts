import { isHttpMethod } from "./util/index";
import { GraphQLParams, Request } from "./types";

export const getGraphQLParameters = (request: Request): GraphQLParams => {
  const { body, method, query: queryParams } = request;

  let operationName;
  let query;
  let variables;
  let extensions;

  if (isHttpMethod("GET", method)) {
    operationName = queryParams.operationName;
    query = queryParams.query;
    variables = queryParams.variables;
    extensions = queryParams.extensions;
  } else if (isHttpMethod("POST", method)) {
    operationName = body?.operationName;
    query = body?.query;
    variables = body?.variables;
    extensions = body?.extension
  }

  return {
    operationName,
    query,
    variables,
    extensions,
  };
};
