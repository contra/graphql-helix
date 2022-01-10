import { ExecutionResult } from "graphql";

export type TransformResultFn = (result: ExecutionResult) => any;
export const DEFAULT_TRANSFORM_RESULT_FN: TransformResultFn = (result: ExecutionResult) => result;
