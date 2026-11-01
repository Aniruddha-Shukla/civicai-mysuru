import { answerQuestion } from "@/lib/ai/answer";
import { isAiConfigured } from "@/lib/ai/client";
import { auditAiRejection } from "@/lib/audit";
import { buildAnswerContext, loadCitizenWardView } from "@/lib/data/citizen";
import { Errors } from "@/lib/errors";
import { json, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireCitizen, requireWard } from "@/lib/rbac";
import { formatIstDate } from "@/lib/time";
import { AskSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/ai/answer — CITIZEN only. Answers ONLY from verified rows for the
 * citizen's own ward; says so plainly when the data has no answer; every answer passes
 * the hallucination firewall, otherwise a deterministic summary is returned instead.
 */
export const POST = route(async (request: Request) => {
  const citizen = requireWard(await requireCitizen());
  const body = await readJson(request, AskSchema, 8 * 1024);
  await enforceRateLimit(`ai-answer:${citizen.id}`, 15, 10 * 60 * 1000);

  const now = new Date();
  const view = await loadCitizenWardView(citizen.wardId, now);
  if (!view) throw Errors.wardRequired();
  const context = buildAnswerContext(view, citizen, now);

  const result = await answerQuestion({
    question: body.question,
    language: citizen.language === "kn" ? "kn" : "en",
    records: context.records,
    deterministicSummary: context.deterministicSummary,
    todayLabel: formatIstDate(now),
    knownPlaces: context.knownPlaces,
    onReject: (rejection) => auditAiRejection(citizen.id, "Profile", citizen.id, rejection),
  });
  return json({ ...result, aiAvailable: isAiConfigured() });
});
