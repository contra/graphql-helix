export const shouldRenderGraphiQL = ({ headers, method }: Request): boolean => {
  return method === 'GET' && !!(headers?.get('accept')?.includes("text/html"));
};
