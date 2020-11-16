import { isHttpMethod } from "./util/is-http-method.ts";
import { Request } from "./types.ts";

export const shouldRenderGraphiQL = ({ headers, method }: Request): boolean => {
  const accept =
    typeof headers.get === "function"
      ? headers.get("accept")
      : (headers as any).accept;

  return isHttpMethod("GET", method) && accept?.includes("text/html");
};
