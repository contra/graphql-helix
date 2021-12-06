const { makeThisModuleAnExecutableReplacer, ParsedImportExportStatement } = require("denoify");

const replaceImportArgument = (parsedImportExportStatement, url) => {
  return ParsedImportExportStatement.stringify({
    ...parsedImportExportStatement,
    parsedArgument: {
      type: "URL",
      url,
    },
  });
};

makeThisModuleAnExecutableReplacer(async ({ parsedImportExportStatement, version }) => {
  if (parsedImportExportStatement.parsedArgument.nodeModuleName === "graphql") {
    return replaceImportArgument(parsedImportExportStatement, `https://cdn.skypack.dev/graphql@${version}?dts`);
  }
  if (parsedImportExportStatement.parsedArgument.nodeModuleName === "cross-undici-fetch") {
    return replaceImportArgument(parsedImportExportStatement, `https://cdn.skypack.dev/cross-undici-fetch@${version}?dts`);
  }

  return undefined;
});
