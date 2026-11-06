/**
 * Demo accounts. Passwords come from env (DEMO_*_PASSWORD) with the README defaults as a
 * fallback. This module is only imported by server code and the seed script, so the
 * passwords never reach the browser bundle.
 */
export const DEMO_CITIZEN_EMAIL = process.env.DEMO_CITIZEN_EMAIL?.trim() || "citizen@civicai.example";
export const DEMO_OPERATOR_EMAIL = process.env.DEMO_OPERATOR_EMAIL?.trim() || "operator@civicai.example";

export function demoPassword(role: "operator" | "citizen"): string {
  return role === "operator"
    ? process.env.DEMO_OPERATOR_PASSWORD?.trim() || "CivicAI-Operator-2026"
    : process.env.DEMO_CITIZEN_PASSWORD?.trim() || "CivicAI-Citizen-2026";
}

/** Demo data (and one-click demo sign-in) is on unless SEED_DEMO_DATA=false. */
export function demoEnabled(): boolean {
  return process.env.SEED_DEMO_DATA?.trim().toLowerCase() !== "false";
}
