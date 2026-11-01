/**
 * HALLUCINATION FIREWALL (§9).
 *
 * After any LLM call that produces citizen-facing text (translation, rephrasing,
 * question answering, complaint drafting) the output is checked here:
 *
 *   1. Every date, time and day-name token (plus relative-day words such as
 *      "tomorrow" and any remaining bare number) is extracted from the AI output.
 *   2. Each token must also appear — in any normalised form, English or Kannada —
 *      among the source fields that were actually given to the model.
 *   3. Optionally (translation), every schedule token in the source must survive
 *      into the output, so a translation cannot silently drop a time or day.
 *
 * If anything fails, the caller discards the AI text and shows the deterministic
 * template instead, and logs the rejection to the AuditLog. Pure module: no I/O,
 * no AI calls, no database access.
 */
import { istDateKey, istWeekday, WEEKDAY_NAMES } from "@/lib/time";

export type SourceValue = string | number | Date | null | undefined;
export type SourceFields = readonly SourceValue[] | Readonly<Record<string, SourceValue | readonly SourceValue[]>>;

export interface TimeToken {
  /** Minutes after midnight. */
  minutes: number;
  /** True when written without AM/PM and with a one-digit hour ("7:00"), i.e. could be AM or PM. */
  ambiguous: boolean;
  raw: string;
}

export interface DateToken {
  day: number;
  month: number;
  year?: number;
  raw: string;
}

export interface ScheduleTokens {
  times: TimeToken[];
  dates: DateToken[];
  weekdays: Map<number, string>;
  relative: Set<string>;
  numbers: Set<number>;
}

export interface GuardOptions {
  /** Translation mode: every source time/day/date must also appear in the output. */
  requireAllSourceTokens?: boolean;
  /** Known place names (e.g. ward names): any that appear in the output must appear in the source. */
  knownPlaces?: readonly string[];
}

export interface GuardVerdict {
  ok: boolean;
  violations: string[];
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const EN_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12,
};
const EN_MONTH_PATTERN = Object.keys(EN_MONTHS).sort((a, b) => b.length - a.length).join("|");

const KN_MONTHS: Record<string, number> = {
  "ಜನವರಿ": 1, "ಫೆಬ್ರವರಿ": 2, "ಫೆಬ್ರುವರಿ": 2, "ಮಾರ್ಚ್": 3, "ಏಪ್ರಿಲ್": 4, "ಮೇ": 5, "ಜೂನ್": 6, "ಜುಲೈ": 7,
  "ಆಗಸ್ಟ್": 8, "ಸೆಪ್ಟೆಂಬರ್": 9, "ಅಕ್ಟೋಬರ್": 10, "ನವೆಂಬರ್": 11, "ಡಿಸೆಂಬರ್": 12,
};
const KN_MONTH_PATTERN = Object.keys(KN_MONTHS).sort((a, b) => b.length - a.length).join("|");

const EN_WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};
const EN_WEEKDAY_PATTERN = Object.keys(EN_WEEKDAYS).sort((a, b) => b.length - a.length).join("|");

const KN_WEEKDAYS: Record<string, number> = {
  "ಭಾನುವಾರ": 0, "ರವಿವಾರ": 0, "ಸೋಮವಾರ": 1, "ಮಂಗಳವಾರ": 2, "ಬುಧವಾರ": 3, "ಗುರುವಾರ": 4, "ಶುಕ್ರವಾರ": 5, "ಶನಿವಾರ": 6,
};

/** Relative-day words are claims about dates too; they may only be used if the source uses them. */
const RELATIVE_WORDS: Record<string, string> = {
  "day after tomorrow": "day_after_tomorrow",
  tomorrow: "tomorrow", today: "today", tonight: "today", yesterday: "yesterday",
  "this weekend": "weekend", weekend: "weekend", "next week": "next_week", "this week": "this_week",
  "next month": "next_month", "ನಾಡಿದ್ದು": "day_after_tomorrow", "ನಾಳೆ": "tomorrow", "ಇಂದು": "today",
  "ಇವತ್ತು": "today", "ನಿನ್ನೆ": "yesterday", "ಮುಂದಿನ ವಾರ": "next_week", "ಈ ವಾರ": "this_week",
};

const KN_MORNING = ["ಬೆಳಿಗ್ಗೆ", "ಬೆಳಗ್ಗೆ", "ಬೆಳಗಿನ", "ಮುಂಜಾನೆ"];
const KN_AFTERNOON = ["ಮಧ್ಯಾಹ್ನ"];
const KN_EVENING = ["ಸಂಜೆ", "ರಾತ್ರಿ"];

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/** Kannada/Devanagari digits → ASCII, Unicode-normalise, lower-case. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[೦-೯]/g, (d) => String(d.charCodeAt(0) - 0x0ce6))
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[’‘]/g, "'")
    .toLowerCase();
}

function validDay(day: number, month: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function toYear(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return raw.length === 2 ? 2000 + n : n;
}

/** Apply a regex globally, hand each match to `onMatch`, and blank the matched text out. */
function consume(text: string, regex: RegExp, onMatch: (m: RegExpExecArray) => boolean): string {
  return text.replace(regex, (...args) => {
    const match = args.slice(0, -2) as unknown as RegExpExecArray;
    return onMatch(match) ? " ".repeat(String(match[0]).length) : String(match[0]);
  });
}

function meridiemToMinutes(hour: number, minute: number, meridiem: "am" | "pm"): number | null {
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const h24 = meridiem === "am" ? hour % 12 : (hour % 12) + 12;
  return h24 * 60 + minute;
}

function parseMeridiem(raw: string | undefined): "am" | "pm" | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/[\s.]/g, "");
  if (compact === "am") return "am";
  if (compact === "pm") return "pm";
  return undefined;
}

export function extractScheduleTokens(input: string): ScheduleTokens {
  const tokens: ScheduleTokens = { times: [], dates: [], weekdays: new Map(), relative: new Set(), numbers: new Set() };
  let text = normalizeText(input);

  const pushDate = (day: number, month: number, year: number | undefined, raw: string) => {
    if (!validDay(day, month)) return false;
    tokens.dates.push({ day, month, year, raw });
    return true;
  };

  // --- dates (first, so "02.11.2026" is never mistaken for a time) ---------
  text = consume(text, /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g, (m) =>
    pushDate(Number(m[3]), Number(m[2]), Number(m[1]), m[0]),
  );
  text = consume(text, /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g, (m) =>
    pushDate(Number(m[1]), Number(m[2]), toYear(m[3]), m[0]),
  );
  text = consume(
    text,
    new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${EN_MONTH_PATTERN})\\.?(?![a-z])(?:,?\\s+(\\d{4}))?`, "g"),
    (m) => pushDate(Number(m[1]), EN_MONTHS[m[2]!]!, toYear(m[3]), m[0]),
  );
  text = consume(
    text,
    new RegExp(`(?<![a-z])(${EN_MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:,?\\s+(\\d{4}))?`, "g"),
    (m) => pushDate(Number(m[2]), EN_MONTHS[m[1]!]!, toYear(m[3]), m[0]),
  );
  text = consume(
    text,
    new RegExp(`(?<!\\d)(\\d{1,2})\\s*(?:ನೇ\\s*)?(${KN_MONTH_PATTERN})(?:\\s*,?\\s*(\\d{4}))?`, "g"),
    (m) => pushDate(Number(m[1]), KN_MONTHS[m[2]!]!, toYear(m[3]), m[0]),
  );
  text = consume(text, new RegExp(`(${KN_MONTH_PATTERN})\\s*(\\d{1,2})(?!\\d)(?:\\s*,?\\s*(\\d{4}))?`, "g"), (m) =>
    pushDate(Number(m[2]), KN_MONTHS[m[1]!]!, toYear(m[3]), m[0]),
  );

  // --- times ---------------------------------------------------------------
  const knPeriod = [...KN_MORNING, ...KN_AFTERNOON, ...KN_EVENING].join("|");
  text = consume(
    text,
    new RegExp(`(${knPeriod})\\s*(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)(?![a-z]))?(?:\\s*ಗಂಟೆ(?:ಗೆ|ಯ|ಯಿಂದ)?)?`, "g"),
    (m) => {
      const hour = Number(m[2]);
      const minute = m[3] ? Number(m[3]) : 0;
      const explicit = parseMeridiem(m[4]);
      // Morning words mean AM; afternoon/evening/night words mean PM ("ಮಧ್ಯಾಹ್ನ 12" is noon).
      const meridiem = explicit ?? (KN_MORNING.includes(m[1]!) ? "am" : "pm");
      const minutes = meridiemToMinutes(hour, minute, meridiem);
      if (minutes === null) return false;
      tokens.times.push({ minutes, ambiguous: false, raw: m[0] });
      return true;
    },
  );
  text = consume(
    text,
    /(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)(?:\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z]))?(?:\s*ಗಂಟೆ(?:ಗೆ|ಯ|ಯಿಂದ)?)?/g,
    (m) => {
      const hourRaw = m[1]!;
      const hour = Number(hourRaw);
      const minute = Number(m[2]);
      const meridiem = parseMeridiem(m[3]);
      if (meridiem) {
        const minutes = meridiemToMinutes(hour, minute, meridiem);
        if (minutes === null) return false;
        tokens.times.push({ minutes, ambiguous: false, raw: m[0] });
        return true;
      }
      if (hour > 23 || minute > 59) return false;
      // "07:00" / "19:00" are unambiguous 24-hour times; "7:00" could be AM or PM.
      const ambiguous = hourRaw.length === 1 && hour !== 0;
      tokens.times.push({ minutes: hour * 60 + minute, ambiguous, raw: m[0] });
      return true;
    },
  );
  text = consume(text, /(?<!\d)(\d{1,2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])/g, (m) => {
    const minutes = meridiemToMinutes(Number(m[1]), 0, parseMeridiem(m[2])!);
    if (minutes === null) return false;
    tokens.times.push({ minutes, ambiguous: false, raw: m[0] });
    return true;
  });
  text = consume(text, /(?<!\d)(\d{1,2})\s*(?:o'?\s?clock|ಗಂಟೆ(?:ಗೆ|ಯ|ಯಿಂದ)?)/g, (m) => {
    const hour = Number(m[1]);
    if (hour > 23) return false;
    tokens.times.push({ minutes: hour * 60, ambiguous: hour <= 12, raw: m[0] });
    return true;
  });
  text = consume(text, /\b(noon|midday|midnight)\b/g, (m) => {
    tokens.times.push({ minutes: m[1] === "midnight" ? 0 : 720, ambiguous: false, raw: m[0] });
    return true;
  });

  // --- weekdays ------------------------------------------------------------
  text = consume(text, new RegExp(`\\b(${EN_WEEKDAY_PATTERN})(?:s)?\\b\\.?`, "g"), (m) => {
    tokens.weekdays.set(EN_WEEKDAYS[m[1]!]!, m[0]);
    return true;
  });
  for (const [word, day] of Object.entries(KN_WEEKDAYS)) {
    if (text.includes(word)) {
      tokens.weekdays.set(day, word);
      text = text.split(word).join(" ");
    }
  }

  // --- relative day words --------------------------------------------------
  for (const [word, key] of Object.entries(RELATIVE_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    const isAscii = /^[a-z ]+$/.test(word);
    const regex = isAscii ? new RegExp(`\\b${word}\\b`, "g") : new RegExp(word, "g");
    if (regex.test(text)) {
      tokens.relative.add(key);
      text = text.replace(regex, " ");
    }
  }

  // --- any remaining bare number --------------------------------------------
  for (const match of text.matchAll(/\d+/g)) tokens.numbers.add(Number(match[0]));

  return tokens;
}

// ---------------------------------------------------------------------------
// Source normalisation
// ---------------------------------------------------------------------------

function flattenSource(sourceFields: SourceFields): SourceValue[] {
  const values: SourceValue[] = [];
  const entries = Array.isArray(sourceFields) ? sourceFields : Object.values(sourceFields);
  for (const value of entries as Array<SourceValue | readonly SourceValue[]>) {
    if (Array.isArray(value)) values.push(...(value as SourceValue[]));
    else values.push(value as SourceValue);
  }
  return values;
}

/** Tokens of everything the model was given. Date objects contribute their IST day, weekday and parts. */
export function sourceTokens(sourceFields: SourceFields): ScheduleTokens & { text: string } {
  const values = flattenSource(sourceFields);
  const textParts: string[] = [];
  const extraDates: DateToken[] = [];
  const extraWeekdays = new Map<number, string>();
  const extraNumbers = new Set<number>();

  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) continue;
      const [y, m, d] = istDateKey(value).split("-").map(Number) as [number, number, number];
      extraDates.push({ day: d, month: m, year: y, raw: istDateKey(value) });
      const weekday = istWeekday(value);
      extraWeekdays.set(weekday, WEEKDAY_NAMES[weekday]!);
      [y, m, d].forEach((n) => extraNumbers.add(n));
      continue;
    }
    textParts.push(String(value));
  }

  const text = textParts.join("\n");
  const tokens = extractScheduleTokens(text);
  // Numbers anywhere in the raw source (including inside dates/times) are allowed in the output.
  for (const match of normalizeText(text).matchAll(/\d+/g)) tokens.numbers.add(Number(match[0]));
  for (const date of tokens.dates) [date.day, date.month, date.year].forEach((n) => n !== undefined && tokens.numbers.add(n));
  for (const time of tokens.times) {
    tokens.numbers.add(Math.floor(time.minutes / 60));
    tokens.numbers.add(Math.floor(time.minutes / 60) % 12 || 12);
    tokens.numbers.add(time.minutes % 60);
  }
  tokens.dates.push(...extraDates);
  for (const [day, name] of extraWeekdays) tokens.weekdays.set(day, name);
  for (const n of extraNumbers) tokens.numbers.add(n);
  return { ...tokens, text: normalizeText(text) };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export function timesMatch(a: TimeToken, b: TimeToken): boolean {
  if (!a.ambiguous && !b.ambiguous) return a.minutes === b.minutes;
  return a.minutes % 720 === b.minutes % 720;
}

export function datesMatch(a: DateToken, b: DateToken): boolean {
  if (a.day !== b.day || a.month !== b.month) return false;
  return a.year === undefined || b.year === undefined || a.year === b.year;
}

export function validateAgainstSource(
  aiOutput: string,
  sourceFields: SourceFields,
  options: GuardOptions = {},
): GuardVerdict {
  const violations: string[] = [];
  if (!aiOutput || aiOutput.trim().length === 0) {
    return { ok: false, violations: ["AI output is empty"] };
  }

  const out = extractScheduleTokens(aiOutput);
  const src = sourceTokens(sourceFields);

  for (const time of out.times) {
    if (!src.times.some((s) => timesMatch(time, s))) violations.push(`time "${time.raw.trim()}" is not in the verified source`);
  }
  for (const date of out.dates) {
    if (!src.dates.some((s) => datesMatch(date, s))) violations.push(`date "${date.raw.trim()}" is not in the verified source`);
  }
  for (const [day, raw] of out.weekdays) {
    if (!src.weekdays.has(day)) violations.push(`day "${raw.trim()}" is not in the verified source`);
  }
  for (const word of out.relative) {
    if (!src.relative.has(word)) violations.push(`relative date "${word.replace(/_/g, " ")}" is not in the verified source`);
  }
  for (const n of out.numbers) {
    if (!src.numbers.has(n)) violations.push(`number "${n}" is not in the verified source`);
  }
  for (const place of options.knownPlaces ?? []) {
    const needle = normalizeText(place).trim();
    if (needle && normalizeText(aiOutput).includes(needle) && !src.text.includes(needle)) {
      violations.push(`place "${place}" is not in the verified source`);
    }
  }

  if (options.requireAllSourceTokens) {
    for (const time of src.times) {
      if (!out.times.some((o) => timesMatch(o, time))) violations.push(`source time "${time.raw.trim()}" is missing from the output`);
    }
    for (const date of src.dates) {
      if (!out.dates.some((o) => datesMatch(o, date))) violations.push(`source date "${date.raw.trim()}" is missing from the output`);
    }
    for (const [day, raw] of src.weekdays) {
      if (!out.weekdays.has(day)) violations.push(`source day "${raw.trim()}" is missing from the output`);
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Run the firewall and choose what the user sees. Rejected AI text is NEVER
 * returned; the deterministic fallback is returned instead.
 */
export function applyFirewall(input: {
  aiOutput: string;
  sourceFields: SourceFields;
  fallback: string;
  options?: GuardOptions;
}): { text: string; origin: "ai" | "fallback"; violations: string[] } {
  const verdict = validateAgainstSource(input.aiOutput, input.sourceFields, input.options);
  return verdict.ok
    ? { text: input.aiOutput.trim(), origin: "ai", violations: [] }
    : { text: input.fallback, origin: "fallback", violations: verdict.violations };
}
