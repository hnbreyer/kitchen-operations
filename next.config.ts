import type { NextConfig } from "next";
const config: NextConfig = {
  typescript: {
    tsconfigPath:
      process.env.PLAYWRIGHT_TEST_SERVER === "1"
        ? "tsconfig.browser.json"
        : "tsconfig.json",
  },
  // Keep browser-test compilation independent of an owner's running dev server.
  distDir:
    process.env.PLAYWRIGHT_TEST_SERVER === "1" ? ".next-playwright" : ".next",
};
export default config;
