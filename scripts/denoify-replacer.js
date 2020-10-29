const {
  makeThisModuleAnExecutableReplacer,
  ParsedImportExportStatement,
} = require("denoify");
const manifest = require("../package.json");

const graphqlVersion = manifest.devDependencies.graphql;

const replaceModuleName = (parsedImportExportStatement, nodeModuleName) => {
  return ParsedImportExportStatement.stringify({
    ...parsedImportExportStatement,
    parsedArgument: {
      ...parsedImportExportStatement.parsedArgument,
      nodeModuleName,
    },
  }).replace(/\\n/g, "\n");
};

makeThisModuleAnExecutableReplacer(
  async ({ importExportStatement, parsedImportExportStatement }) => {
    // Ignore the graphql import inside `renderGraphiQL` template
    if (importExportStatement.includes("cdn.jsdelivr.net/npm/graphql")) {
      return `import { getOperationAST, parse } from "//cdn.jsdelivr.net/npm/graphql@${graphqlVersion}/index.mjs"`;
    }

    if (
      parsedImportExportStatement.parsedArgument.nodeModuleName === "graphql"
    ) {
      return replaceModuleName(
        parsedImportExportStatement,
        `https://cdn.skypack.dev/graphql@${graphqlVersion}?dts`
      );
    }

    return undefined;
  }
);
