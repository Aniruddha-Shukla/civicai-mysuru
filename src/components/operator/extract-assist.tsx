"use client";

import { ClipboardPaste, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { AiUnavailableNotice } from "@/components/ai-unavailable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ExtractionDraft } from "@/lib/ai/extract";
import { apiCall } from "@/lib/client-api";
import { LIMITS } from "@/lib/constants";

export type ExtractResponse =
  | { status: "draft"; draft: ExtractionDraft; warnings: string[]; suggestion: { wardId: string | null; serviceId: string | null } }
  | { status: "could_not_parse"; message: string; warnings: string[] }
  | { status: "unavailable" };

/** AI extraction assist: produces a DRAFT only. Applying it fills the form; the operator still reviews and submits. */
export function ExtractAssist({ aiAvailable, onApply }: { aiAvailable: boolean; onApply: (result: Extract<ExtractResponse, { status: "draft" }>) => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden /> Paste announcement (AI extraction assist)
        </CardTitle>
        <CardDescription>
          The AI only drafts the form fields from the text. It never creates or verifies a notice — you review, correct and submit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!aiAvailable ? (
          <AiUnavailableNotice message="AI assistance is temporarily unavailable. Fill in the form manually — notice creation and verification work as normal." />
        ) : (
          <>
            <Textarea
              rows={5}
              maxLength={LIMITS.announcement}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. MCC Circular No. 130/2026: Due to Kanakadasa Jayanthi on Monday 9 November, garbage collection in Ward 3 (Lakshmipuram) will not take place. Collection will be done on Tuesday 10 November at 7 AM."
            />
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !text.trim()}
              onClick={() =>
                startTransition(async () => {
                  const res = await apiCall<ExtractResponse>("/api/ai/extract", { method: "POST", body: { text } });
                  if (res.ok) setResult(res.data);
                })
              }
            >
              {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <ClipboardPaste aria-hidden />}
              Extract draft
            </Button>
          </>
        )}

        {result?.status === "unavailable" ? (
          <AiUnavailableNotice message="AI assistance is temporarily unavailable. Please fill in the form manually." />
        ) : null}
        {result?.status === "could_not_parse" ? (
          <Alert variant="warning">
            <TriangleAlert aria-hidden />
            <AlertTitle>Could not parse — fill in manually</AlertTitle>
            <AlertDescription>
              <p>{result.message}</p>
              {result.warnings.length ? (
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {result?.status === "draft" ? (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-semibold">Draft (not saved)</p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Affected date</dt>
              <dd>{result.draft.affectedDate}</dd>
              <dt className="text-muted-foreground">Reason</dt>
              <dd>{result.draft.reason}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{result.draft.eventType ?? "—"}</dd>
              <dt className="text-muted-foreground">Area</dt>
              <dd>{result.draft.area ?? "—"}</dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{result.draft.sourceReference ?? "—"}</dd>
              <dt className="text-muted-foreground">Alternative</dt>
              <dd>
                {result.draft.alternativeDate ? `${result.draft.alternativeDate} ${result.draft.alternativeTime ?? "(time not stated)"}` : "none stated"}
              </dd>
            </dl>
            <p className="text-xs text-muted-foreground">
              AI opinion on the source: {result.draft.sourceLooksOfficial ? "looks like an official notice" : "does not look official"} — this is
              not verification.
            </p>
            {result.warnings.length ? (
              <ul className="list-disc pl-4 text-xs text-unverified-foreground">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            <Button type="button" size="sm" onClick={() => onApply(result)}>
              Apply draft to form
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
