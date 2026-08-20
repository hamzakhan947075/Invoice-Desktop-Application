// electron-builder's `files`/`extraResources` copying always strips
// `node_modules` (it treats it as a special case for its own dependency-
// pruning logic, and there's no documented `filter` override that reliably
// disables this for extraResources). Next's `output: "standalone"` bundle
// is only runnable with its own bundled `node_modules` alongside it, so we
// copy it directly with plain fs.cp here, bypassing electron-builder's
// file-copying logic entirely.
import { cp } from "fs/promises";
import path from "path";

/** @param {import("electron-builder").AfterPackContext} context */
export default async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const resourcesDir = path.join(context.appOutDir, "resources");

  const src = path.join(projectDir, ".next", "standalone", "node_modules");
  const dest = path.join(resourcesDir, "standalone", "node_modules");

  console.log(`[after-pack] copying ${src} -> ${dest}`);
  await cp(src, dest, { recursive: true, force: true });
  console.log("[after-pack] done");
}
