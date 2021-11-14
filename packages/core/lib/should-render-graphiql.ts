import { SimpleRequest } from "./types";

export const shouldRenderGraphiQL = ({ headers, method }: SimpleRequest): boolean => {
  return method === 'GET' && !!(headers?.get('accept')?.includes("text/html"));
};
