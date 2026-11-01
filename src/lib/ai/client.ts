/**
 * Server-only Anthropic client wrapper (paper layer 3, Civic Intelligence).
 *
 * - The API key is read from ANTHROPIC_API_KEY on the server only (never NEXT_PUBLIC_*).
 * - Every call uses structured outputs validated by a Zod schema; anything else is
 *   treated as a failure, never "best-effort" parsed.
 * - Any failure (no key, timeout, rate limit, refusal, malformed output) surfaces as
 *   AiUnavailableError so callers fall back to deterministic behaviour.
 *
 * This module — and everything under lib/ai — has no database access at all
 * (enforced by ESLint `no-restricted-imports` and tests/architecture.test.ts).
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const DEFAULT_MODEL = "claude-opus-5-5";
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
  effort?: "low" | "medium" | "high";
}

/** Minimal seam so tests can inject a fake (e.g. deliberately tampered) model. */
export interface AiProvider {
  generateJson<S extends z.ZodType>(request: JsonRequest<S>): Promise<z.infer<S>>;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

class AnthropicProvider implements AiProvider {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  async generateJson<S extends z.ZodType>(request: JsonRequest<S>): Promise<z.infer<S>> {
    try {
      const response = await this.client.messages.parse(
        {
          model: this.model,
          max_tokens: request.maxTokens ?? 4096,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          output_config: { format: zodOutputFormat(request.schema), effort: request.effort ?? "low" },
        },
        { timeout: REQUEST_TIMEOUT_MS },
      );
      if (response.stop_reason === "refusal") throw new AiUnavailableError("refused");
      if (response.stop_reason === "max_tokens") throw new AiUnavailableError("invalid_output", "response truncated");
      if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new AiUnavailableError("invalid_output", "no structured output");
      }
      return response.parsed_output as z.infer<S>;
    } catch (error) {
      if (error instanceof AiUnavailableError) throw error;
      // Most specific first: the timeout error is a subclass of the connection error, which is a subclass of APIError.
      if (error instanceof Anthropic.APIConnectionTimeoutError) throw new AiUnavailableError("timeout");
      if (error instanceof Anthropic.APIConnectionError) throw new AiUnavailableError("api_error", "connection failed");
      if (error instanceof Anthropic.RateLimitError) throw new AiUnavailableError("rate_limited");
      if (error instanceof Anthropic.APIError) throw new AiUnavailableError("api_error", `status ${String(error.status)}`);
      throw new AiUnavailableError("invalid_output", error instanceof Error ? error.message : "unknown");
    }
  }
}

let cached: { key: string; provider: AiProvider } | null = null;

/** Returns null when ANTHROPIC_API_KEY is unset — the app then runs in template-only (degraded) mode. */
export function getAiProvider(): AiProvider | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  if (cached?.key !== apiKey) {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: REQUEST_TIMEOUT_MS });
    cached = { key: apiKey, provider: new AnthropicProvider(client, aiModel()) };
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
