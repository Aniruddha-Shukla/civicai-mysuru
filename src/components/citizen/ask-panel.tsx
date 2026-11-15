"use client";

import { CalendarClock, CalendarDays, CircleSlash, Clock, LoaderCircle, Recycle, Send, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AiUnavailableNotice } from "@/components/ai-unavailable";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LIMITS } from "@/lib/constants";

interface AnswerResponse {
  answer: string;
  status: "answered" | "no_information" | "unavailable" | "rejected";
  origin: "ai" | "deterministic";
  aiAvailable: boolean;
}

type Turn = { id: number; question: string; result: AnswerResponse | null };

/** Assistant avatar: the recycle badge, so it is clear who is "speaking". */
function Avatar() {
  return (
    <span className="bg-hero flex size-9 shrink-0 items-center justify-center rounded-2xl text-lime-300 shadow-md shadow-primary/30" aria-hidden>
      <Recycle className="size-5" />
    </span>
  );
}

/** Ask about your schedule, as a simple chat. Answers come only from verified records. */
export function AskPanel({ aiAvailable }: { aiAvailable: boolean }) {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const examples = [
    { text: t("ask.example1"), Icon: CalendarDays },
    { text: t("ask.example2"), Icon: CalendarClock },
    { text: t("ask.example3"), Icon: Clock },
  ];

  useEffect(() => {
    if (turns.length) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  function ask(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const id = nextId.current++;
    setTurns((all) => [...all, { id, question: q, result: null }]);
    setQuestion("");
    startTransition(async () => {
      const res = await fetch("/api/ai/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? t("common.requestFailed"));
        setTurns((all) => all.filter((turn) => turn.id !== id));
        setQuestion(q);
        return;
      }
      const result = (await res.json()) as AnswerResponse;
      setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, result } : turn)));
    });
  }

  return (
    <div className="space-y-4">
      {!aiAvailable ? <AiUnavailableNotice message={t("ai.unavailable")} /> : null}

      <div className="rounded-[2rem] border bg-card shadow-soft">
        <div className="min-h-[18rem] space-y-5 p-4 sm:p-6" aria-live="polite">
          {turns.length === 0 ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar />
                <p className="rounded-3xl rounded-tl-md bg-secondary px-4 py-3 font-medium text-secondary-foreground">{t("ask.start")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {examples.map(({ text, Icon }, i) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => ask(text)}
                    data-spotlight
                    style={{ "--i": i } as React.CSSProperties}
                    className="spotlight group flex flex-col items-start gap-3 rounded-3xl border bg-background p-4 text-left font-semibold transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="space-y-3">
                {/* question */}
                <div className="flex items-start justify-end gap-3 animate-in fade-in-0 slide-in-from-right-4 duration-300">
                  <p className="max-w-[85%] rounded-3xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground shadow-md shadow-primary/20">{turn.question}</p>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-lime-300 text-emerald-950" aria-label={t("ask.you")}>
                    <UserRound className="size-5" aria-hidden />
                  </span>
                </div>

                {/* answer, or the typing indicator */}
                <div className="flex items-start gap-3 animate-in fade-in-0 slide-in-from-left-4 duration-300">
                  <Avatar />
                  {turn.result ? (
                    <div className="max-w-[85%] space-y-2 rounded-3xl rounded-tl-md bg-secondary px-4 py-3 text-secondary-foreground">
                      <div className="flex flex-wrap gap-1.5">
                        {turn.result.status === "answered" ? (
                          <Badge variant="verified">
                            <ShieldCheck aria-hidden />
                            {t("ask.fromVerified")}
                          </Badge>
                        ) : turn.result.status === "no_information" ? (
                          <Badge variant="unavailable">
                            <CircleSlash aria-hidden />
                            {t("ask.noInformation")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t("ask.deterministic")}</Badge>
                        )}
                      </div>
                      {turn.result.status === "rejected" ? (
                        <p className="flex gap-2 rounded-xl bg-unverified-soft p-2 text-xs text-unverified-foreground">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {t("ask.rejected")}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-line leading-relaxed text-foreground">{turn.result.answer}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-3xl rounded-tl-md bg-secondary px-4 py-3 text-sm text-secondary-foreground">
                      <span className="flex gap-1" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="size-2 rounded-full bg-primary motion-safe:animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                      {t("ask.thinking")}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>

        {/* composer */}
        <form
          className="flex items-end gap-2 border-t p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <div className="min-w-0 flex-1">
            <textarea
              value={question}
              rows={1}
              maxLength={LIMITS.question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(question);
                }
              }}
              placeholder={t("ask.placeholder")}
              aria-label={t("ask.title")}
              className="block max-h-40 min-h-12 w-full resize-none rounded-3xl border border-input bg-background px-4 py-3 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="mt-1 block px-4 text-[11px] text-muted-foreground">
              {t("common.characters", { count: question.length, max: LIMITS.question })}
            </span>
          </div>
          <Button type="submit" size="icon" className="mb-5 size-12 shrink-0 rounded-full" disabled={pending || !question.trim()} aria-label={t("ask.submit")}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          </Button>
        </form>
      </div>

      {turns.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {examples.map(({ text }) => (
            <button
              key={text}
              type="button"
              disabled={pending}
              onClick={() => ask(text)}
              className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
