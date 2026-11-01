"use client";

import { CircleSlash, LoaderCircle, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AiUnavailableNotice } from "@/components/ai-unavailable";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/constants";

interface AnswerResponse {
  answer: string;
  status: "answered" | "no_information" | "unavailable" | "rejected";
  origin: "ai" | "deterministic";
  aiAvailable: boolean;
}

export function AskPanel({ aiAvailable }: { aiAvailable: boolean }) {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const examples = [t("ask.example1"), t("ask.example2"), t("ask.example3")];

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    startTransition(async () => {
      const res = await fetch("/api/ai/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? t("common.requestFailed"));
        return;
      }
      setResult((await res.json()) as AnswerResponse);
    });
  }

  return (
    <div className="space-y-4">
      {!aiAvailable ? <AiUnavailableNotice message={t("ai.unavailable")} /> : null}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <Textarea
          value={question}
          maxLength={LIMITS.question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("ask.placeholder")}
          aria-label={t("ask.title")}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{t("common.characters", { count: question.length, max: LIMITS.question })}</span>
          <Button type="submit" disabled={pending || !question.trim()}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {t("ask.submit")}
          </Button>
        </div>
      </form>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("ask.examples")}</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <Button
              key={example}
              type="button"
              variant="secondary"
              size="sm"
              className="h-auto whitespace-normal py-1.5 text-left"
              onClick={() => {
                setQuestion(example);
                ask(example);
              }}
            >
              {example}
            </Button>
          ))}
        </div>
      </div>

      {result ? (
        <Card aria-live="polite">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{t("ask.answer")}</span>
              {result.status === "answered" ? (
                <Badge variant="verified">
                  <ShieldCheck aria-hidden />
                  {t("ask.fromVerified")}
                </Badge>
              ) : result.status === "no_information" ? (
                <Badge variant="unavailable">
                  <CircleSlash aria-hidden />
                  {t("ask.noInformation")}
                </Badge>
              ) : (
                <Badge variant="secondary">{t("ask.deterministic")}</Badge>
              )}
            </div>
            {result.status === "rejected" ? (
              <p className="flex gap-2 rounded-md bg-unverified-soft p-2 text-xs text-unverified-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("ask.rejected")}
              </p>
            ) : null}
            {result.status === "unavailable" && aiAvailable ? <AiUnavailableNotice message={t("ai.unavailable")} /> : null}
            <p className="whitespace-pre-line leading-relaxed">{result.answer}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
