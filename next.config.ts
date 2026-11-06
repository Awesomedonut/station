import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};
export default config;
