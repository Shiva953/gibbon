import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* The CLI's lockfile sits one directory up; this app is its own root. */
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
