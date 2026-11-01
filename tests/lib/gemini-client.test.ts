/**
 * The Gemini provider must turn every kind of model/API failure into AiUnavailableError
 * (→ deterministic fallback) and only ever return schema-valid data.
 */
import { ApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiUnavailableError, createGeminiProvider, getAiProvider, toGeminiJsonSchema } from "@/lib/ai/client";

const Schema = z.object({ text: z.string(), note: z.string().nullable() });
const request = { system: "SYSTEM", user: "USER", schema: Schema };

function fakeModels(reply: Partial<GenerateContentResponse> | Error) {
  const calls: GenerateContentParameters[] = [];
  return {
    calls,
    async generateContent(params: GenerateContentParameters) {
      calls.push(params);
      if (reply instanceof Error) throw reply;
      return reply as GenerateContentResponse;
    },
  };
}

async function failureReason(reply: Partial<GenerateContentResponse> | Error) {
  try {
    await createGeminiProvider(fakeModels(reply), "test-model").generateJson(request);
    return "no error";
  } catch (error) {
    return error instanceof AiUnavailableError ? error.reason : `unexpected: ${String(error)}`;
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("Gemini provider", () => {
  it("sends a JSON-schema structured-output request with the system instruction and a bounded retry policy", async () => {
    const models = fakeModels({ text: '{"text":"ok","note":null}', candidates: [{ finishReason: "STOP" }] } as never);
    const result = await createGeminiProvider(models, "test-model").generateJson(request);
    expect(result).toEqual({ text: "ok", note: null });

    const params = models.calls[0]!;
    expect(params.model).toBe("test-model");
    expect(params.config?.systemInstruction).toBe("SYSTEM");
    expect(params.config?.responseMimeType).toBe("application/json");
    expect(params.config?.temperature).toBe(0);
    expect(params.config?.httpOptions?.retryOptions?.attempts).toBe(2);
    expect(params.config?.httpOptions?.retryOptions?.httpStatusCodes).not.toContain(429);
  });

  it("converts Zod to Gemini's JSON-schema subset (no $schema, nullable as anyOf)", () => {
    const schema = toGeminiJsonSchema(Schema) as { $schema?: string; properties: Record<string, unknown> };
    expect(schema.$schema).toBeUndefined();
    expect(schema.properties.note).toEqual({ anyOf: [{ type: "string" }, { type: "null" }] });
    expect(schema.properties.text).toEqual({ type: "string" });
  });

  it.each([
    ["non-JSON text", { text: "Sure! Here you go", candidates: [{ finishReason: "STOP" }] }, "invalid_output"],
    ["JSON that does not match the schema", { text: '{"text":42}', candidates: [{ finishReason: "STOP" }] }, "invalid_output"],
    ["an empty response", { text: "", candidates: [{ finishReason: "STOP" }] }, "invalid_output"],
    ["a truncated response", { text: '{"text":"o', candidates: [{ finishReason: "MAX_TOKENS" }] }, "invalid_output"],
    ["a safety-blocked candidate", { text: "", candidates: [{ finishReason: "SAFETY" }] }, "refused"],
    ["a blocked prompt", { text: "", promptFeedback: { blockReason: "SAFETY" } }, "refused"],
  ])("rejects %s", async (_label, reply, reason) => {
    expect(await failureReason(reply as never)).toBe(reason);
  });

  it.each([
    [429, "rate_limited"],
    [500, "api_error"],
    [403, "api_error"],
    [504, "timeout"],
  ])("maps HTTP %i from the API to %s", async (status, reason) => {
    expect(await failureReason(new ApiError({ message: "x", status }))).toBe(reason);
  });

  it("maps a client-side timeout to timeout", async () => {
    const abort = new Error("aborted");
    abort.name = "TimeoutError";
    expect(await failureReason(abort)).toBe("timeout");
  });

  it("is disabled (degraded mode) without GEMINI_API_KEY", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getAiProvider()).toBeNull();
  });
});
