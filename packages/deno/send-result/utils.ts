import { ExecutionResult } from "https://cdn.skypack.dev/graphql@16.0.0-experimental-stream-defer.5?dts";

export type TransformResultFn = (result: ExecutionResult) => any;
export const DEFAULT_TRANSFORM_RESULT_FN: TransformResultFn = (result: ExecutionResult) => result;
