"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while (_)
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                  ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
var __asyncValues =
  (this && this.__asyncValues) ||
  function (o) {
    if (!Symbol.asyncIterator)
      throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator],
      i;
    return m
      ? m.call(o)
      : ((o =
          typeof __values === "function" ? __values(o) : o[Symbol.iterator]()),
        (i = {}),
        verb("next"),
        verb("throw"),
        verb("return"),
        (i[Symbol.asyncIterator] = function () {
          return this;
        }),
        i);
    function verb(n) {
      i[n] =
        o[n] &&
        function (v) {
          return new Promise(function (resolve, reject) {
            (v = o[n](v)), settle(resolve, reject, v.done, v.value);
          });
        };
    }
    function settle(resolve, reject, d, v) {
      Promise.resolve(v).then(function (v) {
        resolve({ value: v, done: d });
      }, reject);
    }
  };
exports.__esModule = true;
exports.processRequest = exports.validateDocument = void 0;
var graphql_1 = require("graphql");
var util_1 = require("./util");
var errors_1 = require("./errors");
var parseQuery = function (query, parse) {
  if (typeof query !== "string" && query.kind === "Document") {
    return query;
  }
  try {
    return parse(query);
  } catch (syntaxError) {
    throw new errors_1.HttpError(400, "GraphQL syntax error.", {
      graphqlErrors: [syntaxError],
    });
  }
};
exports.validateDocument = function (
  schema,
  document,
  validate,
  validationRules
) {
  var validationErrors = validate(schema, document, validationRules);
  if (validationErrors.length) {
    throw new errors_1.HttpError(400, "GraphQL validation error.", {
      graphqlErrors: validationErrors,
    });
  }
};
var getExecutableOperation = function (document, operationName) {
  var operation = graphql_1.getOperationAST(document, operationName);
  if (!operation) {
    throw new errors_1.HttpError(
      400,
      "Could not determine what operation to execute."
    );
  }
  return operation;
};
exports.processRequest = function (options) {
  return __awaiter(void 0, void 0, void 0, function () {
    var contextFactory,
      _a,
      execute,
      operationName,
      _b,
      parse,
      query,
      request,
      rootValueFactory,
      schema,
      _c,
      subscribe,
      _d,
      validate,
      validationRules,
      variables,
      document_1,
      operation,
      variableValues,
      executionContext,
      contextValue,
      _e,
      rootValue,
      _f,
      result_1,
      result_2,
      executionError_1,
      error_1;
    return __generator(this, function (_g) {
      switch (_g.label) {
        case 0:
          (contextFactory = options.contextFactory),
            (_a = options.execute),
            (execute = _a === void 0 ? graphql_1.execute : _a),
            (operationName = options.operationName),
            (_b = options.parse),
            (parse = _b === void 0 ? graphql_1.parse : _b),
            (query = options.query),
            (request = options.request),
            (rootValueFactory = options.rootValueFactory),
            (schema = options.schema),
            (_c = options.subscribe),
            (subscribe = _c === void 0 ? graphql_1.subscribe : _c),
            (_d = options.validate),
            (validate = _d === void 0 ? graphql_1.validate : _d),
            (validationRules = options.validationRules),
            (variables = options.variables);
          _g.label = 1;
        case 1:
          _g.trys.push([1, 15, , 16]);
          if (
            !util_1.isHttpMethod("GET", request.method) &&
            !util_1.isHttpMethod("POST", request.method)
          ) {
            throw new errors_1.HttpError(
              405,
              "GraphQL only supports GET and POST requests.",
              {
                headers: [{ name: "Allow", value: "GET, POST" }],
              }
            );
          }
          if (query == null) {
            throw new errors_1.HttpError(400, "Must provide query string.");
          }
          document_1 = parseQuery(query, parse);
          exports.validateDocument(
            schema,
            document_1,
            validate,
            validationRules
          );
          operation = getExecutableOperation(document_1, operationName);
          if (
            operation.operation === "mutation" &&
            util_1.isHttpMethod("GET", request.method)
          ) {
            throw new errors_1.HttpError(
              405,
              "Can only perform a mutation operation from a POST request.",
              { headers: [{ name: "Allow", value: "POST" }] }
            );
          }
          variableValues = void 0;
          try {
            if (variables) {
              variableValues =
                typeof variables === "string"
                  ? JSON.parse(variables)
                  : variables;
            }
          } catch (_error) {
            throw new errors_1.HttpError(400, "Variables are invalid JSON.");
          }
          _g.label = 2;
        case 2:
          _g.trys.push([2, 13, , 14]);
          executionContext = {
            document: document_1,
            operation: operation,
            variables: variableValues,
          };
          if (!contextFactory) return [3 /*break*/, 4];
          return [4 /*yield*/, contextFactory(executionContext)];
        case 3:
          _e = _g.sent();
          return [3 /*break*/, 5];
        case 4:
          _e = {};
          _g.label = 5;
        case 5:
          contextValue = _e;
          if (!rootValueFactory) return [3 /*break*/, 7];
          return [4 /*yield*/, rootValueFactory(executionContext)];
        case 6:
          _f = _g.sent();
          return [3 /*break*/, 8];
        case 7:
          _f = {};
          _g.label = 8;
        case 8:
          rootValue = _f;
          if (!(operation.operation === "subscription"))
            return [3 /*break*/, 10];
          return [
            4 /*yield*/,
            subscribe(
              schema,
              document_1,
              rootValue,
              contextValue,
              variableValues,
              operationName
            ),
          ];
        case 9:
          result_1 = _g.sent();
          // If errors are encountered while subscribing to the operation, an execution result
          // instead of an AsyncIterable. We only return a PUSH object if we have an AsyncIterable.
          if (util_1.isAsyncIterable(result_1)) {
            return [
              2 /*return*/,
              {
                type: "PUSH",
                subscribe: function (onResult) {
                  return __awaiter(void 0, void 0, void 0, function () {
                    var result_3, result_3_1, executionResult, e_1_1;
                    var e_1, _a;
                    return __generator(this, function (_b) {
                      switch (_b.label) {
                        case 0:
                          _b.trys.push([0, 5, 6, 11]);
                          result_3 = __asyncValues(result_1);
                          _b.label = 1;
                        case 1:
                          return [4 /*yield*/, result_3.next()];
                        case 2:
                          if (!((result_3_1 = _b.sent()), !result_3_1.done))
                            return [3 /*break*/, 4];
                          executionResult = result_3_1.value;
                          onResult(executionResult);
                          _b.label = 3;
                        case 3:
                          return [3 /*break*/, 1];
                        case 4:
                          return [3 /*break*/, 11];
                        case 5:
                          e_1_1 = _b.sent();
                          e_1 = { error: e_1_1 };
                          return [3 /*break*/, 11];
                        case 6:
                          _b.trys.push([6, , 9, 10]);
                          if (
                            !(
                              result_3_1 &&
                              !result_3_1.done &&
                              (_a = result_3["return"])
                            )
                          )
                            return [3 /*break*/, 8];
                          return [4 /*yield*/, _a.call(result_3)];
                        case 7:
                          _b.sent();
                          _b.label = 8;
                        case 8:
                          return [3 /*break*/, 10];
                        case 9:
                          if (e_1) throw e_1.error;
                          return [7 /*endfinally*/];
                        case 10:
                          return [7 /*endfinally*/];
                        case 11:
                          return [2 /*return*/];
                      }
                    });
                  });
                },
                unsubscribe: function () {
                  util_1.stopAsyncIteration(result_1);
                },
              },
            ];
          } else {
            return [
              2 /*return*/,
              {
                type: "RESPONSE",
                payload: result_1,
                status: 200,
                headers: [],
              },
            ];
          }
          return [3 /*break*/, 12];
        case 10:
          return [
            4 /*yield*/,
            execute(
              schema,
              document_1,
              rootValue,
              contextValue,
              variableValues,
              operationName
            ),
          ];
        case 11:
          result_2 = _g.sent();
          // Operations that use @defer and @stream will return an `AsyncIterable` instead of an
          // execution result.
          if (util_1.isAsyncIterable(result_2)) {
            return [
              2 /*return*/,
              {
                type: "MULTIPART_RESPONSE",
                subscribe: function (onResult) {
                  return __awaiter(void 0, void 0, void 0, function () {
                    var result_4, result_4_1, payload, e_2_1;
                    var e_2, _a;
                    return __generator(this, function (_b) {
                      switch (_b.label) {
                        case 0:
                          _b.trys.push([0, 5, 6, 11]);
                          result_4 = __asyncValues(result_2);
                          _b.label = 1;
                        case 1:
                          return [4 /*yield*/, result_4.next()];
                        case 2:
                          if (!((result_4_1 = _b.sent()), !result_4_1.done))
                            return [3 /*break*/, 4];
                          payload = result_4_1.value;
                          onResult(payload);
                          _b.label = 3;
                        case 3:
                          return [3 /*break*/, 1];
                        case 4:
                          return [3 /*break*/, 11];
                        case 5:
                          e_2_1 = _b.sent();
                          e_2 = { error: e_2_1 };
                          return [3 /*break*/, 11];
                        case 6:
                          _b.trys.push([6, , 9, 10]);
                          if (
                            !(
                              result_4_1 &&
                              !result_4_1.done &&
                              (_a = result_4["return"])
                            )
                          )
                            return [3 /*break*/, 8];
                          return [4 /*yield*/, _a.call(result_4)];
                        case 7:
                          _b.sent();
                          _b.label = 8;
                        case 8:
                          return [3 /*break*/, 10];
                        case 9:
                          if (e_2) throw e_2.error;
                          return [7 /*endfinally*/];
                        case 10:
                          return [7 /*endfinally*/];
                        case 11:
                          return [2 /*return*/];
                      }
                    });
                  });
                },
                unsubscribe: function () {
                  util_1.stopAsyncIteration(result_2);
                },
              },
            ];
          } else {
            return [
              2 /*return*/,
              {
                type: "RESPONSE",
                status: 200,
                headers: [],
                payload: result_2,
              },
            ];
          }
          _g.label = 12;
        case 12:
          return [3 /*break*/, 14];
        case 13:
          executionError_1 = _g.sent();
          throw new errors_1.HttpError(
            500,
            "Unexpected error encountered while executing GraphQL request.",
            {
              graphqlErrors: [
                new graphql_1.GraphQLError(executionError_1.message),
              ],
            }
          );
        case 14:
          return [3 /*break*/, 16];
        case 15:
          error_1 = _g.sent();
          return [
            2 /*return*/,
            {
              type: "RESPONSE",
              status: error_1.status || 500,
              headers: error_1.headers || [],
              payload: {
                data: null,
                errors: error_1.graphqlErrors || [
                  new graphql_1.GraphQLError(error_1.message),
                ],
              },
            },
          ];
        case 16:
          return [2 /*return*/];
      }
    });
  });
};
