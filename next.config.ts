import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle (.next/standalone) with only the
  // node_modules it actually needs — this is what the Electron main process
  // spawns as a child process when packaged. See scripts/copy-standalone-assets.mjs.
  output: "standalone",
  experimental: {
    serverActions: {
      // Business logo uploads are capped at 2MB (see settings/actions.ts);
      // this must be >= that, with headroom for multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
