/**
 * Live smoke test of the Gemini integration with YOUR key (makes 2–3 small API calls).
 *   npm run ai:smoke
 * Reads GEMINI_API_KEY / GEMINI_MODEL from .env. It checks that the model answers in the
 * required JSON shape and that every AI output passes (or is correctly rejected by) the
 * hallucination firewall. Nothing is written to the database.
 */
import "dotenv/config";
import { answerQuestion } from "@/lib/ai/answer";
import { aiModel, getAiProvider } from "@/lib/ai/client";
import { transformNotice } from "@/lib/ai/translate";
import { istMidnight } from "@/lib/time";

const CASE_A =
  "Garbage Collection Update. Your regular Monday collection is affected by a municipal holiday. " +
  "Alternative collection: Wednesday, 7:00 AM. Source: Verified municipal notice. " +
  "Please keep your waste ready according to the updated schedule.";

async function main() {
  if (!getAiProvider()) {
    console.error("GEMINI_API_KEY is not set (add it to .env). The app runs fine without it, in template-only mode.");
    process.exit(1);
  }
  console.log(`Model: ${aiModel()}\n`);

  const translation = await transformNotice({
    message: CASE_A,
    mode: "translate_kn",
    onReject: (r) => console.log("  firewall rejected the translation:", r.violations.join("; ")),
  });
  console.log(`1. Kannada translation → status=${translation.status}, origin=${translation.origin}`);
  console.log(`   ${translation.text}\n`);

  const records = [
    {
      id: "arr_demo",
      kind: "alternative" as const,
      text: "VERIFIED alternative collection on Wednesday, 4 November 2026 (2026-11-04) at 7:00 AM (07:00), area: all streets in Ward 1.",
      fields: [istMidnight("2026-11-04"), "07:00"],
    },
  ];
  for (const question of ["When is the alternative collection?", "Will there be collection on Friday at 9 PM?"]) {
    const answer = await answerQuestion({
      question,
      language: "en",
      records,
      deterministicSummary: "(deterministic summary)",
      todayLabel: "Sunday, 1 November 2026",
      onReject: (r) => console.log("  firewall rejected the answer:", r.violations.join("; ")),
    });
    console.log(`2. Q: ${question}\n   → status=${answer.status}, origin=${answer.origin}\n   ${answer.answer}\n`);
  }

  const ok = translation.status !== "unavailable";
  console.log(ok ? "Gemini is reachable and every output went through the firewall." : "Gemini call failed — check the key, model name and free-tier quota.");
  process.exit(ok ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
