#!/usr/bin/env node
// Writes widget/mcc-widget.js, the visualizer widget runtime that card
// results delivered as widgets load from the CDN (see src/cards/widget.ts).
// Runs after tsc as part of `npm run build`. The file is committed, because
// the CDN serves it straight from the tagged repository; test/widget.test.ts
// fails when the committed copy drifts from what this script would write.
//
// Usage: npm run build   (or: node scripts/build-widget.mjs --check)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { buildWidgetBundle, WIDGET_BUNDLE_PATH } = await import(
  pathToFileURL(join(root, "dist", "cards", "widget.js")).href
);
const { SERVER_VERSION } = await import(pathToFileURL(join(root, "dist", "server.js")).href);

const target = join(root, ...WIDGET_BUNDLE_PATH.split("/"));
const bundle = buildWidgetBundle(SERVER_VERSION);

if (process.argv.includes("--check")) {
  const current = await readFile(target, "utf8").catch(() => "");
  if (current !== bundle) {
    console.error(`${WIDGET_BUNDLE_PATH} is stale; run npm run build`);
    process.exit(1);
  }
  console.log(`${WIDGET_BUNDLE_PATH} is current (${bundle.length} chars, ${SERVER_VERSION})`);
} else {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bundle, "utf8");
  console.log(`wrote ${WIDGET_BUNDLE_PATH} (${bundle.length} chars, ${SERVER_VERSION})`);
}
