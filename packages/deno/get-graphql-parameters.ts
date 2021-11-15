import { GraphQLParams } from "./types.ts";

export async function getGraphQLParameters(request: Request): Promise<GraphQLParams> {
  const url = new URL(request.url);

  let operationName: string | undefined;
  let query: string | undefined;
  let variables: any | undefined;

  switch(request.method) {
    case 'GET': {
      operationName = url.searchParams.get('operationName') || undefined;
      query = url.searchParams.get('query') || undefined;
      const variablesStr = url.searchParams.get('variables');
      if (variablesStr) {
        try {
          variables = JSON.parse(variablesStr);
        } catch(e) {
          throw new Error(`Variables are invalid JSON.`);
        }
      }
      break;
    }
    case 'POST': {
      const requestBody = await request.json();
      operationName = requestBody?.operationName;
      query = requestBody?.query;
      variables = requestBody?.variables;
      break;
    }
  }

  return {
    operationName,
    query,
    variables,
  };
}

