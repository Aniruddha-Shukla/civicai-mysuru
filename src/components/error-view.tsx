"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

/** Friendly error boundary body — never shows a stack trace or raw error message. */
export function ErrorView({ error, reset, homeHref = "/" }: { error: Error & { digest?: string }; reset: () => void; homeHref?: string }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">{t("common.somethingWrong")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("common.somethingWrongBody")}</p>
      {error.digest ? <p className="mt-2 font-mono text-[11px] text-muted-foreground">Ref: {error.digest}</p> : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          {t("common.retry")}
        </Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>{t("common.goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
