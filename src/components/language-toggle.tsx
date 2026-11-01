"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function LanguageToggle({ signedIn }: { signedIn: boolean }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = lang === "en" ? "kn" : "en";

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={next === "kn" ? "Switch to Kannada" : "Switch to English"}
      onClick={() =>
        startTransition(async () => {
          document.cookie = `civicai_lang=${next}; path=/; max-age=31536000; samesite=lax`;
          if (signedIn) {
            const res = await fetch("/api/profile", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ language: next }),
            });
            if (!res.ok) toast.error(t("common.requestFailed"));
          }
          router.refresh();
        })
      }
    >
      <Languages aria-hidden />
      {t("nav.switchLanguage")}
    </Button>
  );
}
