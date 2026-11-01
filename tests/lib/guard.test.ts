/**
 * THE most important test in the project: executable proof of the paper's central
 * claim that AI cannot invent or alter a municipal schedule. A deliberately
 * tampered AI response must be rejected and the deterministic text used instead.
 */
import { describe, expect, it, vi } from "vitest";
import type { AiProvider } from "@/lib/ai/client";
import { AiUnavailableError } from "@/lib/ai/client";
import { answerQuestion, NO_VERIFIED_ANSWER, type AnswerRecord } from "@/lib/ai/answer";
import { applyFirewall, extractScheduleTokens, validateAgainstSource } from "@/lib/ai/guard";
import { transformNotice } from "@/lib/ai/translate";
import { istMidnight } from "@/lib/time";

const CASE_A =
  "Garbage Collection Update. Your regular Monday collection is affected by a municipal holiday. " +
  "Alternative collection: Wednesday, 7:00 AM. Source: Verified municipal notice. " +
  "Please keep your waste ready according to the updated schedule.";

/** A fake model that returns whatever text we tell it to. */
function fakeProvider(payload: unknown): AiProvider & { calls: number } {
  const provider = {
    calls: 0,
    async generateJson() {
      provider.calls++;
      return payload as never;
    },
  };
  return provider;
}

describe("validateAgainstSource — token extraction", () => {
  it("normalises English and Kannada times, days and dates", () => {
    const t = extractScheduleTokens("ಬುಧವಾರ ಬೆಳಿಗ್ಗೆ ೭:೦೦ ಗಂಟೆಗೆ, 4 November 2026, 19:30, Mon");
    expect(t.weekdays.has(3)).toBe(true);
    expect(t.weekdays.has(1)).toBe(true);
    expect(t.times.map((x) => x.minutes).sort((a, b) => a - b)).toEqual([420, 1170]);
    expect(t.dates).toMatchObject([{ day: 4, month: 11, year: 2026 }]);
  });
});

describe("hallucination firewall", () => {
  it("REJECTS a tampered time (8:00 AM instead of the verified 7:00 AM) and returns the deterministic text", () => {
    const tampered = CASE_A.replace("7:00 AM", "8:00 AM");
    const result = applyFirewall({ aiOutput: tampered, sourceFields: [CASE_A], fallback: CASE_A });
    expect(result.origin).toBe("fallback");
    expect(result.text).toBe(CASE_A);
    expect(result.violations.join(" ")).toMatch(/8:00 am/i);
  });

  it("REJECTS a tampered day (Thursday instead of Wednesday)", () => {
    const verdict = validateAgainstSource(CASE_A.replace("Wednesday", "Thursday"), [CASE_A]);
    expect(verdict.ok).toBe(false);
    expect(verdict.violations.join(" ")).toMatch(/thursday/i);
  });

  it("REJECTS an invented date and an invented relative day", () => {
    expect(validateAgainstSource(`${CASE_A} This applies on 5 November.`, [CASE_A]).ok).toBe(false);
    expect(validateAgainstSource(`${CASE_A} Collection resumes tomorrow.`, [CASE_A]).ok).toBe(false);
  });

  it("REJECTS AM/PM flips and invented bare numbers", () => {
    expect(validateAgainstSource(CASE_A.replace("7:00 AM", "7:00 PM"), [CASE_A]).ok).toBe(false);
    expect(validateAgainstSource(CASE_A.replace("7:00 AM", "19:00"), [CASE_A]).ok).toBe(false);
    expect(validateAgainstSource(`${CASE_A} Expect 2 trucks.`, [CASE_A]).ok).toBe(false);
  });

  it("ACCEPTS equivalent forms of the same verified facts", () => {
    expect(validateAgainstSource("Collection moved to Wed at 7 AM.", [CASE_A]).ok).toBe(true);
    expect(validateAgainstSource("Alternative: Wednesday 07:00.", [CASE_A]).ok).toBe(true);
    const kannada =
      "ಕಸ ಸಂಗ್ರಹಣೆ ನವೀಕರಣ. ಪುರಸಭೆ ರಜೆಯ ಕಾರಣ ನಿಮ್ಮ ಸಾಮಾನ್ಯ ಸೋಮವಾರದ ಸಂಗ್ರಹಣೆಗೆ ತೊಂದರೆಯಾಗಿದೆ. " +
      "ಪರ್ಯಾಯ ಸಂಗ್ರಹಣೆ: ಬುಧವಾರ, ಬೆಳಿಗ್ಗೆ 7:00. ಮೂಲ: ಪರಿಶೀಲಿತ ಪುರಸಭೆ ಸೂಚನೆ.";
    expect(validateAgainstSource(kannada, [CASE_A], { requireAllSourceTokens: true }).ok).toBe(true);
  });

  it("in translation mode, REJECTS output that silently drops the verified time", () => {
    const dropped = "ಕಸ ಸಂಗ್ರಹಣೆ ನವೀಕರಣ. ಸೋಮವಾರದ ಸಂಗ್ರಹಣೆಗೆ ತೊಂದರೆಯಾಗಿದೆ. ಪರ್ಯಾಯ ಸಂಗ್ರಹಣೆ: ಬುಧವಾರ.";
    const verdict = validateAgainstSource(dropped, [CASE_A], { requireAllSourceTokens: true });
    expect(verdict.ok).toBe(false);
    expect(verdict.violations.join(" ")).toMatch(/missing/);
  });

  it("REJECTS a Kannada translation that changes the day", () => {
    const wrongDay = "ಪರ್ಯಾಯ ಸಂಗ್ರಹಣೆ: ಗುರುವಾರ, ಬೆಳಿಗ್ಗೆ 7:00. ಸೋಮವಾರ."; // Thursday instead of Wednesday
    expect(validateAgainstSource(wrongDay, [CASE_A], { requireAllSourceTokens: true }).ok).toBe(false);
  });

  it("REJECTS an unknown place name when known places are supplied", () => {
    const verdict = validateAgainstSource("Collection in Ward 4 – Nazarbad on Wednesday.", [CASE_A, "Ward 1 – Chamarajapuram"], {
      knownPlaces: ["Ward 1 – Chamarajapuram", "Ward 4 – Nazarbad"],
    });
    expect(verdict.ok).toBe(false);
  });
});

describe("translation path end-to-end with a tampered model", () => {
  it("never shows the tampered translation; falls back to the deterministic English notice and reports the rejection", async () => {
    const tampered = "ಪರ್ಯಾಯ ಸಂಗ್ರಹಣೆ: ಬುಧವಾರ, ಬೆಳಿಗ್ಗೆ 8:00. ಸೋಮವಾರ ರಜೆ."; // 8:00 instead of 7:00
    const onReject = vi.fn();
    const result = await transformNotice({ message: CASE_A, mode: "translate_kn", provider: fakeProvider({ text: tampered }), onReject });
    expect(result.status).toBe("rejected");
    expect(result.origin).toBe("deterministic");
    expect(result.text).toBe(CASE_A);
    expect(result.text).not.toContain("8:00");
    expect(onReject).toHaveBeenCalledOnce();
    expect(onReject.mock.calls[0]![0]).toMatchObject({ task: "translate", rejectedOutput: tampered });
  });

  it("accepts a faithful translation", async () => {
    const faithful =
      "ಕಸ ಸಂಗ್ರಹಣೆ ನವೀಕರಣ. ಪುರಸಭೆ ರಜೆಯ ಕಾರಣ ನಿಮ್ಮ ಸಾಮಾನ್ಯ ಸೋಮವಾರದ ಸಂಗ್ರಹಣೆಗೆ ತೊಂದರೆಯಾಗಿದೆ. ಪರ್ಯಾಯ ಸಂಗ್ರಹಣೆ: ಬುಧವಾರ, ಬೆಳಿಗ್ಗೆ 7:00.";
    const result = await transformNotice({ message: CASE_A, mode: "translate_kn", provider: fakeProvider({ text: faithful }) });
    expect(result).toMatchObject({ status: "ok", origin: "ai", text: faithful });
  });

  it("degrades to the deterministic text when the AI is not configured or fails", async () => {
    expect(await transformNotice({ message: CASE_A, mode: "translate_kn", provider: null })).toMatchObject({
      status: "unavailable",
      text: CASE_A,
    });
    const failing: AiProvider = {
      async generateJson() {
        throw new AiUnavailableError("timeout");
      },
    };
    expect(await transformNotice({ message: CASE_A, mode: "translate_kn", provider: failing })).toMatchObject({
      status: "unavailable",
      text: CASE_A,
    });
  });
});

describe("question answering with a tampered model", () => {
  const records: AnswerRecord[] = [
    {
      id: "arr_1",
      kind: "alternative",
      text: "VERIFIED alternative collection on Wednesday, 4 November 2026 (2026-11-04) at 7:00 AM (07:00).",
      fields: [istMidnight("2026-11-04"), "07:00"],
    },
  ];
  const base = {
    question: "When is the alternative collection?",
    language: "en" as const,
    records,
    deterministicSummary: "DETERMINISTIC SUMMARY",
    todayLabel: "Sunday, 1 November 2026",
  };

  it("rejects an answer with a time that is not in the cited record", async () => {
    const onReject = vi.fn();
    const provider = fakeProvider({ answerable: true, answer: "It is on Wednesday at 9:00 AM.", cited_record_ids: ["arr_1"] });
    const result = await answerQuestion({ ...base, provider, onReject });
    expect(result).toMatchObject({ status: "rejected", answer: "DETERMINISTIC SUMMARY", origin: "deterministic" });
    expect(onReject).toHaveBeenCalledOnce();
  });

  it("returns the exact 'no verified information' sentence when the model says it cannot answer", async () => {
    const provider = fakeProvider({ answerable: false, answer: "Probably Friday!", cited_record_ids: [] });
    const result = await answerQuestion({ ...base, provider });
    expect(result.answer).toBe(NO_VERIFIED_ANSWER.en);
    expect(result.answer).toBe("I don't have verified information about that yet.");
  });

  it("discards an 'answer' that cites no provided record", async () => {
    const provider = fakeProvider({ answerable: true, answer: "Wednesday at 7:00 AM.", cited_record_ids: ["made_up_id"] });
    expect((await answerQuestion({ ...base, provider })).answer).toBe(NO_VERIFIED_ANSWER.en);
  });

  it("passes a grounded answer through", async () => {
    const provider = fakeProvider({ answerable: true, answer: "Wednesday, 4 November at 7:00 AM.", cited_record_ids: ["arr_1"] });
    expect(await answerQuestion({ ...base, provider })).toMatchObject({ status: "answered", origin: "ai" });
  });
});
