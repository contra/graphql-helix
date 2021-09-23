/* eslint-disable no-console */
const { build } = require("esbuild");
const { readFileSync, writeFileSync } = require("fs");

const templateFile = "../core/lib/render-graphiql.template.ts";
const outputFile = "../core/lib/render-graphiql.ts";

function escapeString(str) {
  return JSON.stringify(str);
}

(async function main() {
  console.info(`Compiling GraphiQL TypeScript...`);
  const jsBuild = await build({
    entryPoints: ["src/index.tsx"],
    bundle: true,
    globalName: "GraphQLHelixGraphiQL",
    write: false,
    target: ["es2018"],
    minify: true,
    minifyWhitespace: true,
    legalComments: "none",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.NODE_DEBUG": "undefined",
      setImmediate: "setTimeout",
      global: "window",
    },
  });

  console.info(`Compiling GraphiQL CSS...`);
  const cssBuild = await build({
    entryPoints: ["src/css/graphiql.css"],
    bundle: true,
    write: false,
    minify: true,
    legalComments: "none",
  });

  console.info(`Loading GraphiQL template from ${templateFile}`);
  const tempalteFile = readFileSync(templateFile, "utf8");

  console.info(`Building GraphiQL static files...`);
  const output = tempalteFile
    .replace(`"{CSS}"`, () => escapeString(cssBuild.outputFiles[0].text))
    .replace(`"{JS}"`, () => escapeString(jsBuild.outputFiles[0].text));

  console.info(`Writing GraphiQL rendered file to ${templateFile}`);
  writeFileSync(outputFile, output);
})();
