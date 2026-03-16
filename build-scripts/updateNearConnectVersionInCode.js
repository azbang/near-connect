import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function updateNearConnectVersionInCode() {
  // Read package.json to get the version
  const packageJsonPath = join(import.meta.dirname, "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const version = packageJson.version;

  // Read nearConnectStatic.ts
  const staticFilePath = join(import.meta.dirname, "..", "src", "nearConnectStatic.ts");
  let content = readFileSync(staticFilePath, "utf8");

  // Replace the version
  const versionRegex = /export const NEAR_CONNECT_VERSION = "[^"]*";/;
  const newContent = content.replace(versionRegex, `export const NEAR_CONNECT_VERSION = "${version}";`);

  // Write back to file
  writeFileSync(staticFilePath, newContent, "utf8");

  console.log(`\u2713 Updated NEAR_CONNECT_VERSION to ${version}`);
}

updateNearConnectVersionInCode();
