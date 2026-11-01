/**
 * Zod schemas shared by API routes (server-side validation — authoritative) and
 * forms (react-hook-form, for instant feedback). No endpoint trusts unvalidated input.
 */
import { z } from "zod";
import { COMPLAINT_STATUSES, EVENT_TYPES, LANGUAGES, LIMITS } from "@/lib/constants";
import { isValidDateKey, TIME_24H_REGEX } from "@/lib/time";

/** Strip control characters (keeping newlines/tabs) and trim. */
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export const text = (max: number, min = 1) =>
  z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, min === 1 ? "This field is required." : `Must be at least ${min} characters.`)
        .max(max, `Must be at most ${max} characters.`),
    );

export const id = z.string().trim().min(1, "Required.").max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid id.");

export const dateKey = z
  .string()
  .trim()
  .refine(isValidDateKey, "Use a valid date (YYYY-MM-DD).");

export const time24 = z.string().trim().regex(TIME_24H_REGEX, "Use 24-hour time, e.g. 07:00.");

export const httpUrl = z
  .string()
  .trim()
  .max(LIMITS.url)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Use a full http(s) link.");

/** Optional field that may arrive as "", null or undefined. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

export const isoTimestamp = z.string().trim().min(1, "Required.").refine((v) => !Number.isNaN(Date.parse(v)), "Invalid timestamp.");

// ---------------------------------------------------------------- events

export const CreateEventSchema = z
  .object({
    serviceId: id,
    eventType: z.enum(EVENT_TYPES, "Choose a disruption type."),
    affectedDate: dateKey,
    reason: text(LIMITS.reason),
    source: text(LIMITS.source),
    sourceUrl: optional(httpUrl),
    expiryDate: optional(dateKey),
  })
  .refine((v) => !v.expiryDate || v.expiryDate >= v.affectedDate, {
    path: ["expiryDate"],
    message: "Expiry cannot be before the affected date.",
  });
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const VerifyDecisionSchema = z.object({
  expectedUpdatedAt: isoTimestamp,
  decision: z.enum(["VERIFIED", "UNAVAILABLE"]).default("VERIFIED"),
});

export const WithdrawSchema = z.object({
  expectedUpdatedAt: isoTimestamp,
  reason: text(LIMITS.withdrawalReason),
});

export const EventsQuerySchema = z.object({
  wardId: optional(id),
  status: optional(z.enum(["ACTIVE", "RESOLVED", "EXPIRED", "WITHDRAWN"])),
  verification: optional(z.enum(["VERIFIED", "UNVERIFIED", "UNAVAILABLE"])),
  cursor: optional(id),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ---------------------------------------------------------- arrangements

export const CreateArrangementSchema = z.object({
  eventId: id,
  alternativeDate: dateKey,
  alternativeTime: time24,
  affectedArea: text(LIMITS.area),
  source: text(LIMITS.source),
});
export type CreateArrangementInput = z.infer<typeof CreateArrangementSchema>;

// ------------------------------------------------------------ complaints

export const ComplaintFieldsSchema = z
  .object({
    serviceId: id,
    eventId: optional(id),
    description: text(LIMITS.complaint, 10),
    lat: optional(z.coerce.number().min(-90).max(90)),
    lng: optional(z.coerce.number().min(-180).max(180)),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    path: ["lat"],
    message: "Location needs both latitude and longitude.",
  });

export const ComplaintStatusSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  operatorNote: optional(text(LIMITS.operatorNote)),
  expectedUpdatedAt: isoTimestamp,
});

// --------------------------------------------------------------------- AI

export const AskSchema = z.object({ question: text(LIMITS.question) });
export const DraftComplaintSchema = z.object({ notes: text(LIMITS.complaint), serviceId: id });
export const ExtractSchema = z.object({ text: text(LIMITS.announcement) });

// ---------------------------------------------------------- profile/auth

export const OnboardingSchema = z.object({
  wardId: id,
  language: z.enum(LANGUAGES),
});

export const ResolveWardSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const LoginSchema = z.object({
  email: z.email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const SignupSchema = z.object({
  name: text(LIMITS.name),
  email: z.email("Enter a valid email address.").max(200),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});
