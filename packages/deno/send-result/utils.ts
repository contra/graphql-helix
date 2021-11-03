import { ExecutionResult } from "https://cdn.skypack.dev/graphql@15.4.0-experimental-stream-defer.1?dts";

export type TransformResultFn = (result: ExecutionResult) => any;
export const DEFAULT_TRANSFORM_RESULT_FN: TransformResultFn = (result: ExecutionResult) => result;
