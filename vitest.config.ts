import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // .tsx is included so email templates (React components) can be tested on
    // their rendered HTML rather than on the props they were handed.
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` is a Next.js build-time guard with no runtime export map
      // that Vite can resolve. Server modules that import it (e.g.
      // lib/notifications/organizerFanout.ts) are still worth unit-testing, so
      // point the specifier at a no-op stub inside the test runner.
      "server-only": path.resolve(__dirname, "./src/lib/__mocks__/server-only.ts"),
    },
  },
});
