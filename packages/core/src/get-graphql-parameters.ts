import { isHttpMethod } from "./util";
import type { GraphQLParams, Request } from "./types";

export const getGraphQLParameters = (request: Request): GraphQLParams => {
  const { body, method, query: queryParams } = request;

  let operationName: GraphQLParams["operationName"];
  let query: GraphQLParams["query"];
  let variables: GraphQLParams["variables"];
  let extensions: GraphQLParams["extensions"];

  if (isHttpMethod("GET", method)) {
    operationName = queryParams.operationName;
    query = queryParams.query;
    variables = queryParams.variables;
    extensions = queryParams.extensions;
  } else if (isHttpMethod("POST", method) && body) {
    operationName = body.operationName;
    query = body.query;
    variables = body.variables;
    extensions = body.extensions;
  }

  return {
    operationName,
    query,
    variables,
    extensions,
  };
};
