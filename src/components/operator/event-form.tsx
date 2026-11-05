"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { type ApiError, apiCall } from "@/lib/client-api";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@/lib/constants";
import { renderNoAlternative } from "@/lib/notifications/templates";
import { isValidDateKey, istMidnight, istWeekday, WEEKDAY_NAMES } from "@/lib/time";
import { CreateEventSchema } from "@/lib/validation/schemas";
import { ExtractAssist, type ExtractResponse } from "./extract-assist";

interface WardOption {
  id: string;
  name: string;
  services: { id: string; name: string; normalWeekdays: number[] }[];
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function EventForm({ wards, aiAvailable, todayKey }: { wards: WardOption[]; aiAvailable: boolean; todayKey: string }) {
  const router = useRouter();
  const [wardId, setWardId] = useState(wards[0]?.id ?? "");
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [pending, startTransition] = useTransition();
  const ward = wards.find((w) => w.id === wardId);

  const form = useForm({
    resolver: zodResolver(CreateEventSchema),
    defaultValues: {
      serviceId: ward?.services[0]?.id ?? "",
      eventType: "holiday" as const,
      affectedDate: "",
      reason: "",
      source: "",
      sourceUrl: "",
      expiryDate: "",
    },
  });
  const values = form.watch();
  const service = ward?.services.find((s) => s.id === values.serviceId);

  const preview = useMemo(() => {
    if (!service || !values.affectedDate || !isValidDateKey(values.affectedDate) || !values.reason?.trim()) return null;
    return renderNoAlternative({ affectedDate: istMidnight(values.affectedDate), reason: values.reason, service: { name: service.name } });
  }, [service, values.affectedDate, values.reason]);

  const notRegularDay =
    service && values.affectedDate && isValidDateKey(values.affectedDate) && !service.normalWeekdays.includes(istWeekday(istMidnight(values.affectedDate)));

  function applyDraft(result: Extract<ExtractResponse, { status: "draft" }>) {
    const targetWard = wards.find((w) => w.id === result.suggestion.wardId);
    if (targetWard) setWardId(targetWard.id);
    const svc = result.suggestion.serviceId ?? targetWard?.services[0]?.id;
    if (svc) form.setValue("serviceId", svc);
    form.setValue("affectedDate", result.draft.affectedDate);
    form.setValue("reason", result.draft.reason);
    if (result.draft.eventType) form.setValue("eventType", result.draft.eventType);
    if (result.draft.sourceReference) form.setValue("source", result.draft.sourceReference);
    toast.info(
      targetWard
        ? "Draft applied. Review every field before creating the notice."
        : "Draft applied — the ward could not be matched from the text; choose it manually.",
    );
  }

  const onSubmit = form.handleSubmit((data) =>
    startTransition(async () => {
      setServerError(null);
      const res = await apiCall<{ event: { id: string }; conflicts: unknown[] }>("/api/events", { method: "POST", body: data });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      if (res.data.conflicts.length > 0) {
        toast.warning("Created — this notice conflicts with another notice for the same ward, service and day. Review it.");
      } else {
        toast.success("Notice created as UNVERIFIED. Verify it to notify citizens.");
      }
      router.push(`/operator/events/${res.data.event.id}`);
      router.refresh();
    }),
  );

  const existingId = (serverError?.details as { existingEventId?: string } | undefined)?.existingEventId;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr),380px]">
      <Card>
        <CardHeader>
          <CardTitle>Disruption notice</CardTitle>
          <CardDescription>Created as UNVERIFIED. No citizen is notified until you verify it against the municipal source.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ward">Ward</Label>
                <NativeSelect
                  id="ward"
                  value={wardId}
                  onChange={(e) => {
                    setWardId(e.target.value);
                    form.setValue("serviceId", wards.find((w) => w.id === e.target.value)?.services[0]?.id ?? "");
                  }}
                >
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="serviceId">Service</Label>
                <NativeSelect id="serviceId" {...form.register("serviceId")}>
                  {ward?.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.normalWeekdays.map((d) => WEEKDAY_NAMES[d]?.slice(0, 3)).join(", ")})
                    </option>
                  ))}
                </NativeSelect>
                <FieldError message={form.formState.errors.serviceId?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eventType">Disruption type</Label>
                <NativeSelect id="eventType" {...form.register("eventType")}>
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EVENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="affectedDate">Affected collection date</Label>
                <Input id="affectedDate" type="date" min={todayKey} {...form.register("affectedDate")} />
                <FieldError message={form.formState.errors.affectedDate?.message} />
              </div>
            </div>
            {notRegularDay ? (
              <Alert variant="warning">
                <TriangleAlert aria-hidden />
                <AlertDescription>This date is not a regular collection day for the selected service. Double-check the notice.</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" placeholder="a municipal holiday" {...form.register("reason")} />
              <p className="text-xs text-muted-foreground">Completes the sentence “…collection is affected by ___”.</p>
              <FieldError message={form.formState.errors.reason?.message} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="source">Municipal source</Label>
                <Input id="source" placeholder="MCC Circular No. 114/2026" {...form.register("source")} />
                <FieldError message={form.formState.errors.source?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sourceUrl">Source link (optional)</Label>
                <Input id="sourceUrl" type="url" placeholder="https://…" {...form.register("sourceUrl")} />
                <FieldError message={form.formState.errors.sourceUrl?.message} />
              </div>
            </div>
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="expiryDate">Expires after (optional)</Label>
              <Input id="expiryDate" type="date" min={values.affectedDate || todayKey} {...form.register("expiryDate")} />
              <p className="text-xs text-muted-foreground">Default: the day before the next regular collection day.</p>
              <FieldError message={form.formState.errors.expiryDate?.message} />
            </div>

            {preview ? (
              <div className="rounded-md border border-unavailable/30 bg-unavailable-soft p-3 text-sm text-unavailable-foreground">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Citizens will receive (after verification, until an alternative is verified)</p>
                {preview}
              </div>
            ) : null}

            {serverError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {serverError.message}{" "}
                  {existingId ? (
                    <Link className="underline" href={`/operator/events/${existingId}`}>
                      Open the existing notice
                    </Link>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Create notice (unverified)
            </Button>
          </form>
        </CardContent>
      </Card>
      <ExtractAssist aiAvailable={aiAvailable} onApply={applyDraft} />
    </div>
  );
}
