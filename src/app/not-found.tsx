import { SearchX } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n";
import { currentLang } from "@/lib/session-lang";

export default async function NotFound() {
  const t = getT(await currentLang());
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container flex h-14 items-center">
        <Brand />
      </header>
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <SearchX className="size-6" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold">{t("common.notFound")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("common.notFoundBody")}</p>
        <Button asChild className="mt-6">
          <Link href="/">{t("common.goHome")}</Link>
        </Button>
      </main>
    </div>
  );
}
