// nginx serves css/svg with a 30-day immutable cache, so asset URLs carry a content hash
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const assets = ["output.css", "favicon.svg"];

const hash = (file) =>
  createHash("sha256").update(readFileSync(`dist/${file}`)).digest("hex").slice(0, 8);

for (const page of readdirSync("dist").filter((f) => f.endsWith(".html"))) {
  let html = readFileSync(`dist/${page}`, "utf8");
  for (const asset of assets) {
    html = html.replaceAll(`${asset}"`, `${asset}?v=${hash(asset)}"`);
  }
  writeFileSync(`dist/${page}`, html);
}
