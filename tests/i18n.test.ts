import { describe, expect, it } from "vitest";
import en from "@locales/en.json";
import kn from "@locales/kn.json";
import { lookup, translate } from "@/lib/i18n";

function leaves(obj: unknown, prefix = ""): string[] {
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : leaves(v, `${prefix}${k}.`),
  );
}

describe("i18n", () => {
  const enKeys = new Set(leaves(en));
  const knKeys = leaves(kn);

  it("Kannada has no keys that English lacks (no orphans)", () => {
    expect(knKeys.filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("Kannada covers the citizen-critical strings", () => {
    for (const key of ["status.VERIFIED", "status.UNVERIFIED", "status.UNAVAILABLE", "notifications.title", "dashboard.noDisruptionsBody", "ai.unavailable"]) {
      expect(lookup(kn, key), key).toBeTruthy();
    }
  });

  it("falls back to English for a key missing in Kannada and never renders the raw key", () => {
    const missing = [...enKeys].find((k) => !knKeys.includes(k));
    expect(missing).toBeDefined();
    const text = translate("kn", missing as never);
    expect(text).toBe(lookup(en, missing!));
    expect(text).not.toBe(missing);
  });

  it("interpolates variables", () => {
    expect(translate("en", "dashboard.greeting", { name: "Asha" })).toBe("Hello, Asha");
    expect(translate("kn", "dashboard.greeting", { name: "Asha" })).toBe("ನಮಸ್ಕಾರ, Asha");
  });

  it("an unknown key yields an empty string, not the key", () => {
    expect(translate("kn", "notification.title" as never)).toBe("");
  });
});
