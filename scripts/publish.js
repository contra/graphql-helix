const { execSync } = require("child_process");
const { readFileSync, readdirSync } = require("fs");

const readManifest = (package) =>
  JSON.parse(readFileSync(`./packages/${package}/package.json`, "utf8"));
const exec = (command, cwd) => execSync(command, { stdio: "inherit", cwd });

const package = process.argv[2];
const release = process.argv[3];

if (!readdirSync("./packages").includes(package)) {
  throw new Error(`Invalid package: "${package}".`);
}

if (!["patch", "minor", "major"].includes(release)) {
  throw new Error(`Invalid release type: "${release}".`);
}

const packageName = readManifest(package).name;

exec(`yarn workspace ${packageName} version --${release} --no-git-tag-version`);

exec(`yarn workspace ${packageName} build`);

const newVersion = readManifest(package).version;
const tag = `${packageName}@${newVersion}`;

exec(`git add -A`);

exec(`git commit -m "chore:publish" -m "" -m "- ${tag}"`);

exec(`git tag -a ${tag} -m "${tag}"`);

exec(`npm publish`, `./packages/${package}`);
