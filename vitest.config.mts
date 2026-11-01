import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // tsconfig keeps `jsx: "preserve"` for Next.js; tests compile JSX with the automatic runtime.
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  resolve: {
    alias: {
      "@/": r("./src/"),
      "@locales/": r("./locales/"),
      "server-only": r("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    restoreMocks: true,
  },
});
