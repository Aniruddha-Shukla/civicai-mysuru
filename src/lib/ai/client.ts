/**
 * Server-only Google Gemini client wrapper (paper layer 3, Civic Intelligence).
 *
 * - The API key is read from GEMINI_API_KEY on the server only (never NEXT_PUBLIC_*).
 *   A free Google AI Studio key works; free-tier quotas are small, which is fine because
 *   every AI feature degrades to deterministic behaviour when the quota runs out.
 * - Every call requests structured JSON output (responseJsonSchema) AND re-validates the
 *   result with the same Zod schema; anything else is treated as a failure, never
 *   "best-effort" parsed.
 * - Any failure (no key, timeout, quota/rate limit, safety block, malformed output)
 *   surfaces as AiUnavailableError so callers fall back to deterministic behaviour.
 *
 * This module — and everything under lib/ai — has no database access at all
 * (enforced by ESLint `no-restricted-imports` and tests/architecture.test.ts).
 */
import "server-only";
import { ApiError, GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { z } from "zod";

/** Stable Flash-Lite model: the most generous free-tier quota. Override with GEMINI_MODEL. */
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 20_000;

export type AiFailureReason = "not_configured" | "timeout" | "rate_limited" | "api_error" | "refused" | "invalid_output";

export class AiUnavailableError extends Error {
  constructor(
    public readonly reason: AiFailureReason,
    detail?: string,
  ) {
    super(detail ? `AI unavailable (${reason}): ${detail}` : `AI unavailable (${reason})`);
    this.name = "AiUnavailableError";
  }
}

export interface JsonRequest<S extends z.ZodType> {
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
}

/** Minimal seam so tests can inject a fake (e.g. deliberately tampered) model. */
export interface AiProvider {
  generateJson<S extends z.ZodType>(request: JsonRequest<S>): Promise<z.infer<S>>;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function aiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Convert a Zod schema to the JSON Schema subset Gemini's `responseJsonSchema` accepts:
 * drop `$schema`, and express nullable fields (`type: ["string", "null"]`) as `anyOf`.
 */
export function toGeminiJsonSchema(schema: z.ZodType): unknown {
  const convert = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(convert);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "$schema") continue;
      out[key] = convert(value);
    }
    if (Array.isArray(out.type)) {
      const types = out.type as string[];
      delete out.type;
      return { ...out, anyOf: types.map((type) => ({ type })) };
    }
    return out;
  };
  return convert(z.toJSONSchema(schema));
}

const BLOCKED_FINISH_REASONS = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "LANGUAGE", "OTHER"]);

/** The part of the SDK client we use — lets tests substitute a fake. */
export type GeminiModels = { generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> };

export function createGeminiProvider(models: GeminiModels, model: string): AiProvider {
  return {
    async generateJson<S extends z.ZodType>(request: JsonRequest<S>): Promise<z.infer<S>> {
      let response: GenerateContentResponse;
      try {
        response = await models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          config: {
            systemInstruction: request.system,
            responseMimeType: "application/json",
            responseJsonSchema: toGeminiJsonSchema(request.schema),
            maxOutputTokens: request.maxTokens ?? 2048,
            temperature: 0,
            abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            httpOptions: {
              timeout: REQUEST_TIMEOUT_MS,
              // One quick retry for transient server errors; never retry 429 (free-tier quota) — degrade instead.
              retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 2, httpStatusCodes: [500, 502, 503, 504] },
            },
          },
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 429) throw new AiUnavailableError("rate_limited");
          if (error.status === 408 || error.status === 504) throw new AiUnavailableError("timeout");
          throw new AiUnavailableError("api_error", `status ${error.status}`);
        }
        if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
          throw new AiUnavailableError("timeout");
        }
        throw new AiUnavailableError("api_error", error instanceof Error ? error.message : "unknown");
      }

      if (response.promptFeedback?.blockReason) throw new AiUnavailableError("refused", String(response.promptFeedback.blockReason));
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === "MAX_TOKENS") throw new AiUnavailableError("invalid_output", "response truncated");
      if (finishReason && BLOCKED_FINISH_REASONS.has(finishReason)) throw new AiUnavailableError("refused", finishReason);

      const text = response.text?.trim();
      if (!text) throw new AiUnavailableError("invalid_output", "empty response");
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new AiUnavailableError("invalid_output", "response is not valid JSON");
      }
      const parsed = request.schema.safeParse(data);
      if (!parsed.success) throw new AiUnavailableError("invalid_output", "response does not match the schema");
      return parsed.data as z.infer<S>;
    },
  };
}

let cached: { key: string; provider: AiProvider } | null = null;

/** Returns null when GEMINI_API_KEY is unset — the app then runs in template-only (degraded) mode. */
export function getAiProvider(): AiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (cached?.key !== apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    cached = { key: apiKey, provider: createGeminiProvider(ai.models, aiModel()) };
  }
  return cached.provider;
}

/** Strip control characters and cap length before any user text reaches a prompt. */
export function sanitizePromptInput(text: string, maxLength: number): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}
