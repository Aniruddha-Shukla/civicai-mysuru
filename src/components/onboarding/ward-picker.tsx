"use client";

import { Check, LoaderCircle, LocateFixed, MapPin, Search, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import type { WardResolution } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { MapWard } from "./ward-map";

const WardMap = dynamic(() => import("./ward-map"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-muted sm:h-80" />,
});

interface PickerWard extends MapWard {
  zone: string;
}

export function WardPicker({
  wards,
  currentWardId,
  language,
  mapboxToken,
  center,
}: {
  wards: PickerWard[];
  currentWardId: string | null;
  language: "en" | "kn";
  mapboxToken: string | null;
  center: { lng: number; lat: number; zoom: number };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(currentWardId);
  const [lang, setLang] = useState(language);
  const [query, setQuery] = useState("");
  const [mapFailed, setMapFailed] = useState(false);
  const [resolution, setResolution] = useState<WardResolution | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [saving, startSaving] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? wards.filter((w) => `${w.name} ${w.zone}`.toLowerCase().includes(q)) : wards;
  }, [query, wards]);

  const candidateIds = new Set(resolution?.candidates.map((c) => c.wardId) ?? []);
  const needsConfirmation = resolution?.status === "near_boundary" && selected === resolution.wardId;

  async function resolvePoint(lat: number, lng: number) {
    setPin({ lat, lng });
    setResolving(true);
    setConfirmed(false);
    try {
      const res = await fetch("/api/wards/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      if (!res.ok) throw new Error();
      const { resolution: r } = (await res.json()) as { resolution: WardResolution };
      setResolution(r);
      setSelected(r.wardId);
    } catch {
      toast.error(t("common.requestFailed"));
    } finally {
      setResolving(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return toast.error(t("report.locationFailed"));
    navigator.geolocation.getCurrentPosition(
      (pos) => void resolvePoint(pos.coords.latitude, pos.coords.longitude),
      () => toast.error(t("report.locationFailed")),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  function save() {
    if (!selected) return;
    startSaving(async () => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wardId: selected, language: lang }),
      });
      if (!res.ok) {
        toast.error(t("common.requestFailed"));
        return;
      }
      document.cookie = `civicai_lang=${lang}; path=/; max-age=31536000; samesite=lax`;
      toast.success(t("onboarding.saved"));
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {mapboxToken && !mapFailed ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("onboarding.mapHint")}</p>
          <WardMap
            token={mapboxToken}
            wards={wards}
            center={center}
            selectedWardId={selected}
            pin={pin}
            onPick={(lat, lng) => void resolvePoint(lat, lng)}
            onFail={() => setMapFailed(true)}
          />
        </div>
      ) : mapboxToken && mapFailed ? (
        <Alert variant="muted">
          <MapPin aria-hidden />
          <AlertDescription>{t("onboarding.mapUnavailable")}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="button" variant="outline" onClick={useMyLocation} disabled={resolving} className="w-full sm:w-auto">
        {resolving ? <LoaderCircle className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
        {t("onboarding.useLocation")}
      </Button>

      {resolution?.status === "near_boundary" ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertDescription>{t("onboarding.boundaryNotice")}</AlertDescription>
        </Alert>
      ) : null}
      {resolution?.status === "ambiguous" ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertDescription>{t("onboarding.ambiguousNotice")}</AlertDescription>
        </Alert>
      ) : null}
      {resolution?.status === "outside" ? (
        <Alert variant="muted">
          <MapPin aria-hidden />
          <AlertDescription>{t("onboarding.outsideNotice")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="ward-search">{t("onboarding.search")}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="ward-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ward 1, Lakshmipuram…" />
        </div>
        <div role="radiogroup" aria-label={t("onboarding.title")} className="grid gap-2">
          {filtered.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">{t("onboarding.noMatches")}</p> : null}
          {filtered.map((ward) => {
            const active = selected === ward.id;
            return (
              <button
                key={ward.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setSelected(ward.id);
                  setConfirmed(false);
                }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent",
                  active && "border-primary ring-2 ring-primary/30",
                  !active && candidateIds.has(ward.id) && "border-unverified/60 bg-unverified-soft",
                )}
              >
                <span>
                  <span className="block font-medium">{ward.name}</span>
                  <span className="text-xs text-muted-foreground">{ward.zone}</span>
                </span>
                {active ? <Check className="size-5 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t("onboarding.demoBoundaries")}</p>
      </div>

      {needsConfirmation ? (
        <label className="flex items-start gap-2 rounded-md border border-unverified/40 bg-unverified-soft p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[hsl(var(--primary))]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          {t("onboarding.confirmWard")}
        </label>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="language">{t("onboarding.language")}</Label>
        <NativeSelect id="language" value={lang} onChange={(e) => setLang(e.target.value === "kn" ? "kn" : "en")}>
          <option value="en">English</option>
          <option value="kn">ಕನ್ನಡ (Kannada)</option>
        </NativeSelect>
      </div>

      <Button className="w-full" size="lg" disabled={!selected || saving || (needsConfirmation && !confirmed)} onClick={save}>
        {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {t("onboarding.save")}
      </Button>
    </div>
  );
}
