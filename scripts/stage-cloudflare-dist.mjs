import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, ".open-next");
const distRoot = path.join(projectRoot, "dist");
const destination = path.join(projectRoot, "dist", "server");
const assetDestination = path.join(distRoot, "assets");

fs.rmSync(destination, { recursive: true, force: true });
fs.rmSync(assetDestination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });

function copyTree(sourcePath, destinationPath) {
  const stat = fs.lstatSync(sourcePath);
  if (stat.isSymbolicLink()) return copyTree(fs.realpathSync(sourcePath), destinationPath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyTree(path.join(sourcePath, entry), path.join(destinationPath, entry));
    }
    return;
  }
  fs.copyFileSync(sourcePath, destinationPath);
}

copyTree(source, destination);

const stagedAssets = path.join(destination, "assets");
if (!fs.existsSync(stagedAssets)) throw new Error("OpenNext assets were not generated.");
fs.renameSync(stagedAssets, assetDestination);

const worker = path.join(destination, "worker.js");
const entrypoint = path.join(destination, "index.js");
if (!fs.existsSync(worker)) throw new Error("OpenNext worker.js was not generated.");
fs.renameSync(worker, entrypoint);

for (const requiredFile of [
  "server-functions/default/handler.mjs",
  "server-functions/default/index.mjs",
  ".build/durable-objects/queue.js",
]) {
  if (!fs.existsSync(path.join(destination, requiredFile))) {
    throw new Error(`OpenNext output is missing ${requiredFile}.`);
  }
}
