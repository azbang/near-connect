#!/usr/bin/env node

import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";

const DIST_DIR = join(import.meta.dirname, "..", "dist");

async function walk(dir, ext) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full, ext)));
    } else if (entry.name.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveImportPath(fromFile, importPath, targetExt) {
  const dir = dirname(fromFile);

  // If already has the target extension, leave it
  if (importPath.endsWith(targetExt)) return importPath;

  // If has .js extension, replace with target
  if (importPath.endsWith(".js")) {
    return importPath.replace(/\.js$/, targetExt);
  }

  // Extensionless: try file first, then directory/index
  const asFile = resolve(dir, importPath + targetExt);
  if (await exists(asFile)) {
    return importPath + targetExt;
  }

  const asIndex = resolve(dir, importPath, "index" + targetExt);
  if (await exists(asIndex)) {
    return importPath + "/index" + targetExt;
  }

  // Fallback: just add extension
  return importPath + targetExt;
}

async function fixFiles(subdir, ext, pattern, replacer) {
  const dir = join(DIST_DIR, subdir);
  let dirExists;
  try {
    await access(dir);
    dirExists = true;
  } catch {
    dirExists = false;
  }
  if (!dirExists) return;

  const files = await walk(dir, ext);
  let fixed = 0;
  for (const file of files) {
    const content = await readFile(file, "utf8");
    let updated = content;

    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      const original = match[0];
      const importPath = match[1];
      // Only fix relative imports
      if (!importPath.startsWith(".")) continue;
      const resolved = await resolveImportPath(file, importPath, ext === ".cjs" ? ".cjs" : ".js");
      if (resolved !== importPath) {
        const replacement = original.replace(importPath, resolved);
        updated = updated.split(original).join(replacement);
      }
    }

    if (updated !== content) {
      await writeFile(file, updated);
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} ${ext} files (${files.length} total in ${subdir}/)`);
}

async function fix() {
  // Fix CJS: require("./path") -> require("./path.cjs")
  await fixFiles("cjs", ".cjs", /require\("(\.[^"]+)"\)/g);
  // Fix CJS: dynamic import("./path") -> import("./path.cjs")
  await fixFiles("cjs", ".cjs", /import\("(\.[^"]+)"\)/g);

  // Fix ESM: from "./path" -> from "./path.js"
  await fixFiles("esm", ".js", /from\s+"(\.[^"]+)"/g);
  // Fix ESM: dynamic import("./path") -> import("./path.js")
  await fixFiles("esm", ".js", /import\("(\.[^"]+)"\)/g);
}

fix().catch((err) => {
  console.error(err);
  process.exit(1);
});
