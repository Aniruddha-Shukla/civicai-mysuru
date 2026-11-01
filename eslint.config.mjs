import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts", "prisma/migrations/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "react/no-danger": "error",
    },
  },
  {
    // ARCHITECTURE RULE — "No AI authority" (paper §14): the AI layer has no database
    // handle at all, so it cannot create or modify CivicEvent / AlternativeArrangement rows.
    files: ["src/lib/ai/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/lib/db", message: "The AI layer must not access the database (no AI authority over schedules)." },
            { name: "@prisma/client", message: "The AI layer must not access the database (no AI authority over schedules)." },
            { name: "@/lib/audit", message: "Report rejections through the onReject callback; callers write the AuditLog." },
          ],
          patterns: [{ group: ["@/lib/notifications/*", "@/lib/data/*", "@/app/*"], message: "The AI layer is a leaf module." }],
        },
      ],
    },
  },
  {
    // Server secrets must never be reachable from client components.
    files: ["src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/lib/db", message: "Client components must not import the database client." },
            { name: "@/lib/ai/client", message: "The Anthropic client is server-only." },
            { name: "@/lib/supabase/admin", message: "The service-role client is server-only." },
          ],
        },
      ],
    },
  },
];

export default config;
