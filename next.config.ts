import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/worlds", destination: "/", permanent: true },
      { source: "/world", destination: "/", permanent: true },
    ];
  },
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};
export default config;
