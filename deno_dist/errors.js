"use strict";
var __extends =
  (this && this.__extends) ||
  (function () {
    var extendStatics = function (d, b) {
      extendStatics =
        Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array &&
          function (d, b) {
            d.__proto__ = b;
          }) ||
        function (d, b) {
          for (var p in b)
            if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
      return extendStatics(d, b);
    };
    return function (d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype =
        b === null
          ? Object.create(b)
          : ((__.prototype = b.prototype), new __());
    };
  })();
exports.__esModule = true;
exports.HttpError = void 0;
var HttpError = /** @class */ (function (_super) {
  __extends(HttpError, _super);
  function HttpError(status, message, details) {
    if (details === void 0) {
      details = {};
    }
    var _this = _super.call(this, message) || this;
    _this.status = status;
    _this.headers = details.headers;
    _this.graphqlErrors = details.graphqlErrors;
    return _this;
  }
  return HttpError;
})(Error);
exports.HttpError = HttpError;
