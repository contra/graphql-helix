"use strict";
exports.__esModule = true;
exports.isHttpMethod = void 0;
exports.isHttpMethod = function (target, subject) {
  return (
    subject.localeCompare(target, undefined, { sensitivity: "accent" }) === 0
  );
};
