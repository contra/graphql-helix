import { SimpleRequest } from "./types.ts";

export const shouldRenderGraphiQL = ({ headers, method }: SimpleRequest): boolean => {
  return method === 'GET' && !!(headers?.get('accept')?.includes("text/html"));
};
