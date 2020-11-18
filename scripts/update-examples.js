const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const examplesDir = path.resolve(__dirname, "../examples");
const exampleNames = fs.readdirSync(examplesDir);
for (const exampleName of exampleNames) {
  execSync("npm install graphql-helix@latest", {
    cwd: path.join(examplesDir, exampleName),
    stdio: "inherit",
  });
}
