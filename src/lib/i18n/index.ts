/**
 * Minimal typed i18n. Keys are derived from locales/en.json at compile time, so a
 * typo is a type error. Kannada strings fall back to English key-by-key; a raw key
 * like "notifications.title" is never rendered.
 */
import en from "@locales/en.json";
import kn from "@locales/kn.json";

export type Lang = "en" | "kn";
export const LANGS: readonly Lang[] = ["en", "kn"];

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<typeof en>;
export type TVars = Record<string, string | number>;
export type TFunction = (key: TKey, vars?: TVars) => string;

const dictionaries: Record<Lang, unknown> = { en, kn };

export function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" && node.length > 0 ? node : undefined;
}

function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function normalizeLang(value: string | null | undefined): Lang {
  return value === "kn" ? "kn" : "en";
}

export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  const text = lookup(dictionaries[lang], key) ?? lookup(en, key);
  if (text === undefined) {
    // Unreachable for typed keys; still never leak the raw key to the UI.
    return "";
  }
  return interpolate(text, vars);
}

export function getT(lang: Lang): TFunction {
  return (key, vars) => translate(lang, key, vars);
}

const dateFormatters: Record<Lang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  kn: new Intl.DateTimeFormat("kn-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
};
const dateTimeFormatters: Record<Lang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
  kn: new Intl.DateTimeFormat("kn-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
};

/** IST date in the UI language (render on the server to avoid ICU differences at hydration). */
export function formatDateFor(lang: Lang, date: Date): string {
  return dateFormatters[lang].format(date);
}

export function formatDateTimeFor(lang: Lang, date: Date): string {
  return `${dateTimeFormatters[lang].format(date)} IST`;
}

const KN_WEEKDAY_NAMES = ["ಭಾನುವಾರ", "ಸೋಮವಾರ", "ಮಂಗಳವಾರ", "ಬುಧವಾರ", "ಗುರುವಾರ", "ಶುಕ್ರವಾರ", "ಶನಿವಾರ"] as const;
const EN_WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function weekdayNameFor(lang: Lang, weekday: number): string {
  return (lang === "kn" ? KN_WEEKDAY_NAMES : EN_WEEKDAY_NAMES)[weekday] ?? "";
}
