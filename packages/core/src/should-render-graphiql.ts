import { isHttpMethod } from "./util/is-http-method";
import type { Request } from "./types";

export const shouldRenderGraphiQL = ({ headers, method }: Request): boolean => {
  const accept =
    typeof headers.get === "function"
      ? headers.get("accept")
      : (headers as any).accept;

  return isHttpMethod("GET", method) && accept?.includes("text/html");
};
