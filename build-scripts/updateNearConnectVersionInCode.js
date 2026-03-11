const fs = require("fs");
const path = require("path");

function updateNearConnectVersionInCode() {
  // Read package.json to get the version
  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const version = packageJson.version;

  // Read nearConnectStatic.ts
  const staticFilePath = path.join(__dirname, "..", "src", "nearConnectStatic.ts");
  let content = fs.readFileSync(staticFilePath, "utf8");

  // Replace the version
  const versionRegex = /export const NEAR_CONNECT_VERSION = "[^"]*";/;
  const newContent = content.replace(versionRegex, `export const NEAR_CONNECT_VERSION = "${version}";`);

  // Write back to file
  fs.writeFileSync(staticFilePath, newContent, "utf8");

  console.log(`✓ Updated NEAR_CONNECT_VERSION to ${version}`);
}

// Run the function if this script is executed directly
if (require.main === module) {
  updateNearConnectVersionInCode();
}

module.exports = { updateNearConnectVersionInCode };
