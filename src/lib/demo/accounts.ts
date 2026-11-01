/** Demo account emails (passwords live only in prisma/seed.ts / env, never in the app bundle). */
export const DEMO_CITIZEN_EMAIL = process.env.DEMO_CITIZEN_EMAIL?.trim() || "citizen@civicai.example";
export const DEMO_OPERATOR_EMAIL = process.env.DEMO_OPERATOR_EMAIL?.trim() || "operator@civicai.example";
