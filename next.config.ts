import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle (.next/standalone) with only the
  // node_modules it actually needs — this is what the Electron main process
  // spawns as a child process when packaged. See scripts/copy-standalone-assets.mjs.
  output: "standalone",
  // The Electron window loads http://127.0.0.1:<port> (see electron/main.ts),
  // not localhost, so without this Next dev blocks the client JS chunks as
  // cross-origin — the page renders but no button/form is interactive.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      // Business logo uploads are capped at 2MB (see settings/actions.ts);
      // this must be >= that, with headroom for multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
