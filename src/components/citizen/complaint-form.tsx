"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, LoaderCircle, LocateFixed, Send, WandSparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useI18n } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS, PHOTO_MIME_TYPES } from "@/lib/constants";
import { id, text } from "@/lib/validation/schemas";

const FormSchema = z.object({
  serviceId: id,
  eventId: z.string().optional(),
  description: text(LIMITS.complaint, 10),
});

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

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor="description">{t("report.description")}</Label>
          {aiAvailable ? (
            <Button type="button" variant="ghost" size="sm" onClick={aiDraft} disabled={drafting || description.trim().length === 0}>
              {drafting ? <LoaderCircle className="animate-spin" aria-hidden /> : <WandSparkles aria-hidden />}
              {t("report.aiDraft")}
            </Button>
          ) : null}
        </div>
        <Textarea id="description" rows={5} maxLength={LIMITS.complaint} {...form.register("description")} />
        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>{form.formState.errors.description?.message ?? t("report.descriptionHelp")}</span>
          <span>{t("common.characters", { count: description.length, max: LIMITS.complaint })}</span>
        </div>
        {draftNote ? (
          <Alert variant={draftNote.tone}>
            <AlertDescription>{draftNote.text}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="photo">{t("report.photo")}</Label>
        {photo ? (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <ImagePlus className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{photo.name}</span>
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={() => setPhoto(null)} aria-label="Remove photo">
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <Input id="photo" type="file" accept={PHOTO_MIME_TYPES.join(",")} onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
        )}
        <p className={photoError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{photoError ?? t("report.photoHelp")}</p>
      </div>

      <div className="space-y-1.5 rounded-md border p-3">
        {location ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <LocateFixed className="size-4 text-primary" aria-hidden />
              {t("report.locationAttached")} ({location.lat}, {location.lng})
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={() => setLocation(null)} aria-label="Remove location">
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={attachLocation}>
            <LocateFixed aria-hidden />
            {t("report.location")}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">{t("report.locationHelp")}</p>
      </div>

      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={submitting || services.length === 0}>
        {submitting ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {t("report.submit")}
      </Button>
    </form>
  );
}
