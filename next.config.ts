import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Avoids Next inferring a parent
  // directory as the root when unrelated lockfiles exist higher up.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
