"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarX, Camera, Check, LoaderCircle, LocateFixed, PencilLine, Send, Trash, Truck, WandSparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useI18n } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS, PHOTO_MIME_TYPES } from "@/lib/constants";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { id, text } from "@/lib/validation/schemas";

const FormSchema = z.object({
  serviceId: id,
  eventId: z.string().optional(),
  description: text(LIMITS.complaint, 10),
});

/** Picture tiles so residents can report in one tap instead of typing from scratch. */
const CATEGORIES: { key: string; label: TKey; text?: TKey; Icon: typeof Truck; tone: string }[] = [
  { key: "missed", label: "report.cat.missed", text: "report.cat.missedText", Icon: CalendarX, tone: "bg-rose-100 text-rose-700" },
  { key: "bin", label: "report.cat.bin", text: "report.cat.binText", Icon: Trash, tone: "bg-amber-100 text-amber-700" },
  { key: "skipped", label: "report.cat.skipped", text: "report.cat.skippedText", Icon: Truck, tone: "bg-indigo-100 text-indigo-700" },
  { key: "other", label: "report.cat.other", Icon: PencilLine, tone: "bg-violet-100 text-violet-700" },
];

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-sm transition-colors duration-300",
            done ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {done ? <Check key="done" className="size-4 animate-in zoom-in-50 spin-in-12 duration-300" aria-hidden /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ComplaintForm({
  services,
  notices,
  aiAvailable,
}: {
  services: { id: string; name: string }[];
  notices: { id: string; serviceId: string; label: string }[];
  aiAvailable: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [draftNote, setDraftNote] = useState<{ tone: "success" | "warning" | "muted"; text: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();
  const [submitting, startSubmitting] = useTransition();

  const form = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: { serviceId: services[0]?.id ?? "", eventId: "", description: "" },
  });
  const serviceId = form.watch("serviceId");
  const description = form.watch("description") ?? "";
  const templates = CATEGORIES.flatMap((c) => (c.text ? [t(c.text)] : []));

  function chooseCategory(key: string) {
    setCategory(key);
    const chosen = CATEGORIES.find((c) => c.key === key);
    // Only replace the text if the citizen has not written their own words yet.
    if (description.trim() === "" || templates.includes(description.trim())) {
      form.setValue("description", chosen?.text ? t(chosen.text) : "", { shouldValidate: Boolean(chosen?.text) });
    }
  }

  function pickPhoto(file: File | null) {
    setPhotoError(null);
    if (!file) return setPhoto(null);
    if (!(PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) return setPhotoError(t("report.photoWrongType"));
    if (file.size > LIMITS.photoBytes) return setPhotoError(t("report.photoTooLarge"));
    setPhoto(file);
  }

  function attachLocation() {
    if (!("geolocation" in navigator)) return toast.error(t("report.locationFailed"));
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }),
      () => toast.error(t("report.locationFailed")),
      { timeout: 10000 },
    );
  }

  function aiDraft() {
    const notes = description.trim();
    if (!notes) return;
    startDrafting(async () => {
      const res = await fetch("/api/ai/draft-complaint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes, serviceId }),
      });
      if (!res.ok) {
        toast.error(t("common.requestFailed"));
        return;
      }
      const body = (await res.json()) as { draft: string; status: "ok" | "unavailable" | "rejected" };
      if (body.status === "ok") {
        form.setValue("description", body.draft, { shouldValidate: true });
        setDraftNote({ tone: "success", text: t("report.aiDraftNote") });
      } else if (body.status === "rejected") {
        setDraftNote({ tone: "warning", text: t("report.aiDraftRejected") });
      } else {
        setDraftNote({ tone: "muted", text: t("ai.unavailable") });
      }
    });
  }

  const onSubmit = form.handleSubmit((values) =>
    startSubmitting(async () => {
      setServerError(null);
      const data = new FormData();
      data.set("serviceId", values.serviceId);
      if (values.eventId) data.set("eventId", values.eventId);
      data.set("description", values.description);
      if (location) {
        data.set("lat", String(location.lat));
        data.set("lng", String(location.lng));
      }
      if (photo) data.set("photo", photo);
      const res = await fetch("/api/complaints", { method: "POST", body: data });
      const body = (await res.json().catch(() => null)) as { complaint?: { id: string }; error?: { message?: string } } | null;
      if (!res.ok || !body?.complaint) {
        setServerError(body?.error?.message ?? t("common.requestFailed"));
        return;
      }
      toast.success(t("report.submitted"));
      router.push(`/report/${body.complaint.id}`);
      router.refresh();
    }),
  );

  const relevantNotices = notices.filter((n) => n.serviceId === serviceId);
  const done = [category !== null || description.trim().length >= 10, description.trim().length >= 10, photo !== null || location !== null];
  const progress = done.filter(Boolean).length;

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-7">
      {/* How far along the report is: fills as each step is done */}
      <div className="sticky top-[6.75rem] z-20 -mx-1 rounded-full bg-background/80 p-1 backdrop-blur" aria-hidden>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-[width] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ width: `${Math.max(6, (progress / 3) * 100)}%` }}
          />
        </div>
      </div>

      <Step n={1} title={t("report.step1")} done={done[0]!}>
        <div role="radiogroup" aria-label={t("report.step1")} className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseCategory(c.key)}
                className={cn(
                  "group relative flex min-h-[6.5rem] flex-col items-start justify-between gap-2 rounded-2xl border-2 bg-card p-3 text-left text-sm font-semibold shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.97]",
                  active ? "border-primary shadow-md ring-2 ring-primary/20" : "border-border",
                )}
              >
                <span className={cn("flex size-10 items-center justify-center rounded-xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110", c.tone, active && "motion-safe:animate-wiggle")}>
                  <c.Icon className="size-5" aria-hidden />
                </span>
                {t(c.label)}
                {active ? (
                  <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 duration-200">
                    <Check className="size-4" aria-hidden />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={2} title={t("report.step2")} done={done[1]!}>
        <div className="space-y-1.5">
          <Textarea
            id="description"
            rows={4}
            maxLength={LIMITS.complaint}
            placeholder={t("report.description")}
            aria-label={t("report.description")}
            className="text-base"
            {...form.register("description")}
          />
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className={form.formState.errors.description ? "text-destructive" : undefined}>
              {form.formState.errors.description?.message ?? t("report.descriptionHelp")}
            </span>
            <span>{t("common.characters", { count: description.length, max: LIMITS.complaint })}</span>
          </div>
          {aiAvailable ? (
            <Button type="button" variant="ghost" size="sm" onClick={aiDraft} disabled={drafting || description.trim().length === 0}>
              {drafting ? <LoaderCircle className="animate-spin" aria-hidden /> : <WandSparkles aria-hidden />}
              {t("report.aiDraft")}
            </Button>
          ) : null}
          {draftNote ? (
            <Alert variant={draftNote.tone}>
              <AlertDescription>{draftNote.text}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        {services.length > 1 || relevantNotices.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.length > 1 ? (
              <div className="space-y-1.5">
                <Label htmlFor="serviceId">{t("report.service")}</Label>
                <NativeSelect id="serviceId" {...form.register("serviceId")}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
            {relevantNotices.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="eventId">{t("report.linkNotice")}</Label>
                <NativeSelect id="eventId" {...form.register("eventId")}>
                  <option value="">{t("report.noNotice")}</option>
                  {relevantNotices.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </div>
        ) : null}
      </Step>

      <Step n={3} title={t("report.step3")} done={done[2]!}>
        {photo ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-primary/40 bg-secondary p-3 text-sm animate-in fade-in-0 zoom-in-95">
            <span className="flex min-w-0 items-center gap-2">
              <Camera className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="truncate font-medium">{photo.name}</span>
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={() => setPhoto(null)} aria-label="Remove photo">
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <label className="group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/40 p-6 text-center transition-all hover:border-primary hover:bg-secondary focus-within:ring-2 focus-within:ring-ring">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-110">
              <Camera className="size-6" aria-hidden />
            </span>
            <span className="font-semibold text-primary">{t("report.addPhoto")}</span>
            <span className="text-xs text-muted-foreground">{t("report.photoHelp")}</span>
            <input type="file" className="sr-only" accept={PHOTO_MIME_TYPES.join(",")} onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {photoError ? <p className="text-xs text-destructive">{photoError}</p> : null}

        {location ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm">
            <span className="flex items-center gap-2">
              <LocateFixed className="size-4 text-primary" aria-hidden />
              {t("report.locationAttached")}
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={() => setLocation(null)} aria-label="Remove location">
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={attachLocation}>
            <LocateFixed aria-hidden />
            {t("report.location")}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">{t("report.locationHelp")}</p>
      </Step>

      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-base" disabled={submitting || services.length === 0}>
        {submitting ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {t("report.submit")}
      </Button>
    </form>
  );
}
