export const EVENT_TYPES = [
  "holiday",
  "breakdown",
  "road_closure",
  "weather",
  "special_event",
  "operational",
  "emergency",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  holiday: "Holiday",
  breakdown: "Vehicle breakdown",
  road_closure: "Road closure",
  weather: "Weather",
  special_event: "Special event",
  operational: "Operational constraint",
  emergency: "Emergency decision",
};

export const COMPLAINT_STATUSES = ["open", "in_review", "resolved", "rejected"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const LANGUAGES = ["en", "kn"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LIMITS = {
  reason: 200,
  source: 200,
  url: 500,
  area: 200,
  complaint: 1000,
  operatorNote: 500,
  question: 500,
  announcement: 5000,
  name: 80,
  withdrawalReason: 300,
  /** Vercel serverless functions reject request bodies above 4.5 MB, so photos are capped below that. */
  photoBytes: 4 * 1024 * 1024,
} as const;

export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** How far ahead the scheduled sync looks for disruptions (proactive window). */
export const LOOKAHEAD_DAYS = 7;
/** Hard cap on notification rows written per sync invocation (serverless time limit). */
export const SYNC_ROW_BUDGET = 500;
/** Hard cap on events examined per sync invocation. */
export const SYNC_EVENT_BUDGET = 100;
