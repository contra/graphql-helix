"use strict";
exports.__esModule = true;
exports.stopAsyncIteration = void 0;
exports.stopAsyncIteration = function (asyncIterable) {
  var method = asyncIterable[Symbol.asyncIterator];
  var asyncIterator = method.call(asyncIterable);
  if (asyncIterator["return"]) {
    asyncIterator["return"]();
  }
};
