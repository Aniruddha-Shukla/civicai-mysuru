import { describe, expect, it } from "vitest";
import type { AiProvider } from "@/lib/ai/client";
import { AiUnavailableError } from "@/lib/ai/client";
import { extractAnnouncement } from "@/lib/ai/extract";
import { sniffImageType } from "@/lib/image";

const TEXT =
  "MCC Circular No. 130/2026: Due to Kanakadasa Jayanthi on 9 November 2026, garbage collection in Ward 3 (Lakshmipuram) will not take place. " +
  "Collection will be done on 10 November 2026 at 7:00 AM.";

const provider = (payload: unknown): AiProvider => ({ generateJson: async () => payload as never });
const good = {
  service: "Garbage Collection",
  affected_date: "2026-11-09",
  area: "Ward 3 (Lakshmipuram)",
  reason: "Kanakadasa Jayanthi",
  event_type: "holiday",
  alternative_date: "2026-11-10",
  alternative_time: "07:00",
  source_reference: "MCC Circular No. 130/2026",
  source_verified: true,
};

describe("AI extraction never silently guesses", () => {
  it("returns a draft when every value is in the text", async () => {
    const result = await extractAnnouncement({ text: TEXT, todayKey: "2026-11-01", provider: provider(good) });
    expect(result).toMatchObject({ status: "draft", draft: { affectedDate: "2026-11-09", alternativeTime: "07:00", eventType: "holiday" } });
  });

  it("malformed / partial JSON → could_not_parse (fill in manually)", async () => {
    const result = await extractAnnouncement({ text: TEXT, todayKey: "2026-11-01", provider: provider({ affected_date: "2026-11-09" }) });
    expect(result.status).toBe("could_not_parse");
  });

  it("an SDK parse failure is reported as could_not_parse, not as a draft", async () => {
    const failing: AiProvider = {
      generateJson: async () => {
        throw new AiUnavailableError("invalid_output");
      },
    };
    expect((await extractAnnouncement({ text: TEXT, todayKey: "2026-11-01", provider: failing })).status).toBe("could_not_parse");
  });

  it("drops a date the model computed that is not written in the text", async () => {
    const result = await extractAnnouncement({
      text: TEXT,
      todayKey: "2026-11-01",
      provider: provider({ ...good, alternative_date: "2026-11-11", alternative_time: "08:00" }),
    });
    expect(result.status).toBe("draft");
    if (result.status === "draft") {
      expect(result.draft.alternativeDate).toBeNull();
      expect(result.warnings.join(" ")).toMatch(/not written explicitly/);
    }
  });

  it("a missing required field (affected date not in the text) → could_not_parse", async () => {
    const result = await extractAnnouncement({ text: TEXT, todayKey: "2026-11-01", provider: provider({ ...good, affected_date: "2026-11-16" }) });
    expect(result.status).toBe("could_not_parse");
  });

  it("degrades to 'unavailable' without an API key", async () => {
    expect(await extractAnnouncement({ text: TEXT, todayKey: "2026-11-01", provider: null })).toEqual({ status: "unavailable" });
  });
});

describe("photo validation by magic bytes", () => {
  it("recognises JPEG, PNG and WebP", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
  });

  it("rejects HTML/SVG disguised as an image", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<!doctype html>"))).toBeNull();
  });
});
