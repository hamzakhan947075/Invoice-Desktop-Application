// `next build` with `output: "standalone"` does NOT copy `public/` or
// `.next/static/` into `.next/standalone/` automatically — without this,
// the packaged app builds successfully but 404s on every static asset.
import { cp, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.error("`.next/standalone` not found — run `next build` first.");
  process.exit(1);
}

await mkdir(path.join(standaloneDir, "public"), { recursive: true });
await cp(path.join(root, "public"), path.join(standaloneDir, "public"), { recursive: true });

await mkdir(path.join(standaloneDir, ".next", "static"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"), {
  recursive: true,
});

console.log("Copied public/ and .next/static/ into .next/standalone/.");
