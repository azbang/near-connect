import { copyFileSync } from "copy-file";
import path from "path";

copyFileSync(path.join(import.meta.dirname, "../../repository/manifest.json"), path.join(import.meta.dirname, "../public/repository/manifest.json"));
console.log("Wallets manifest.json file copied");