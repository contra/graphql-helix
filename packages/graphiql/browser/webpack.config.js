const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const { execSync } = require("child_process");

/**
 * @type {import("webpack").Configuration}
 */
const config = {
  entry: path.resolve(__dirname, "./index.tsx"),
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },
  output: {
    filename: "graphiql.min.js",
    library: "GraphQLHelixGraphiQL",
    libraryTarget: "umd",
    path: path.resolve(__dirname, "../bundle"),
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.NODE_DEBUG": "undefined",
      setImmediate: "setTimeout",
    }),
    {
      apply(compiler) {
        compiler.hooks.beforeCompile.tap("Before", () => {
          console.log("----------------Start bundling----------------");
        });
        compiler.hooks.afterEmit.tap("AfterEmit", () => {
          execSync("pnpm after:webpack", {
            stdio: "inherit",
          });
          console.log("----------------End bundling----------------");
        });
      },
    },
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      meros: require.resolve("meros/browser"),
    },
  },
};

module.exports = config;
