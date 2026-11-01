"use client";

import { Ban, CircleSlash, LoaderCircle, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiCall } from "@/lib/client-api";
import { LIMITS } from "@/lib/constants";
import { isValidDateKey, TIME_24H_REGEX } from "@/lib/time";

type Dispatch = { notificationsCreated: number; complete: boolean; supersededByConflict?: boolean; deferredToSync?: boolean } | null;

function dispatchMessage(prefix: string, dispatch: Dispatch) {
  if (!dispatch) return prefix;
  if (dispatch.deferredToSync) return `${prefix} Notifications will be sent by the scheduled sync.`;
  if (dispatch.supersededByConflict) return `${prefix} Not announced: a more recently verified conflicting notice is shown to citizens.`;
  return `${prefix} ${dispatch.notificationsCreated} citizen notification(s) sent${dispatch.complete ? "" : " so far (the sync will finish the rest)"}.`;
}

function MessagePreview({ label, message }: { label: string; message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border bg-muted/50 p-3 text-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {message}
    </div>
  );
}

export function VerifyEventActions({ eventId, updatedAt, preview }: { eventId: string; updatedAt: string; preview: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const send = (decision: "VERIFIED" | "UNAVAILABLE") =>
    startTransition(async () => {
      const res = await apiCall<{ dispatch: Dispatch; conflicts: unknown[] }>(`/api/events/${eventId}/verify`, {
        method: "POST",
        body: { expectedUpdatedAt: updatedAt, decision },
      });
      if (res.ok) {
        toast.success(decision === "VERIFIED" ? dispatchMessage("Notice verified.", res.data.dispatch) : "Marked as unavailable (could not be confirmed).");
        if (res.data.conflicts?.length) toast.warning("This notice conflicts with another notice for the same ward, service and day.");
        setOpen(false);
      }
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <ShieldCheck aria-hidden /> Verify notice
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify this notice?</DialogTitle>
            <DialogDescription>
              Confirm you have checked it against the municipal source. Citizens in the ward are notified immediately with exactly this message.
            </DialogDescription>
          </DialogHeader>
          <MessagePreview label="Message citizens will receive" message={preview} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => send("VERIFIED")} disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
              Verify and notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Mark this notice as UNAVAILABLE (the source could not be confirmed)? Citizens are not notified.")) send("UNAVAILABLE");
        }}
      >
        <CircleSlash aria-hidden /> Could not confirm
      </Button>
    </div>
  );
}

export function WithdrawEventDialog({ eventId, updatedAt, preview, notifiedCount }: { eventId: string; updatedAt: string; preview: string; notifiedCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Ban aria-hidden /> Withdraw notice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw this notice?</DialogTitle>
          <DialogDescription>
            The notice is never silently removed. {notifiedCount} citizen(s) who were already notified receive this retraction immediately.
          </DialogDescription>
        </DialogHeader>
        <MessagePreview label="Retraction message" message={preview} />
        <div className="space-y-1.5">
          <Label htmlFor="withdraw-reason">Reason (internal, recorded in the audit log)</Label>
          <Textarea id="withdraw-reason" maxLength={LIMITS.withdrawalReason} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending || !reason.trim()}
            onClick={() =>
              startTransition(async () => {
                const res = await apiCall<{ dispatch: Dispatch }>(`/api/events/${eventId}/withdraw`, {
                  method: "POST",
                  body: { expectedUpdatedAt: updatedAt, reason },
                });
                if (res.ok) {
                  toast.success(dispatchMessage("Notice withdrawn.", res.data.dispatch).replace("notification(s)", "retraction(s)"));
                  setOpen(false);
                }
                router.refresh();
              })
            }
          >
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Ban aria-hidden />}
            Withdraw and send retractions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArrangementForm({ eventId, minDate }: { eventId: string; minDate: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ alternativeDate: "", alternativeTime: "07:00", affectedArea: "", source: "" });
  const [pending, startTransition] = useTransition();
  const valid =
    isValidDateKey(values.alternativeDate) && TIME_24H_REGEX.test(values.alternativeTime) && values.affectedArea.trim() && values.source.trim();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await apiCall("/api/arrangements", { method: "POST", body: { eventId, ...values } });
          if (res.ok) {
            toast.success("Alternative recorded as UNVERIFIED. Verify it to notify citizens.");
            setValues({ alternativeDate: "", alternativeTime: "07:00", affectedArea: "", source: "" });
          }
          router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="alt-date">Alternative date</Label>
        <Input id="alt-date" type="date" min={minDate} value={values.alternativeDate} onChange={(e) => setValues({ ...values, alternativeDate: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="alt-time">Time (24-hour)</Label>
        <Input id="alt-time" type="time" value={values.alternativeTime} onChange={(e) => setValues({ ...values, alternativeTime: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="alt-area">Affected area</Label>
        <Input id="alt-area" maxLength={LIMITS.area} placeholder="All streets in Ward 1" value={values.affectedArea} onChange={(e) => setValues({ ...values, affectedArea: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="alt-source">Municipal source</Label>
        <Input id="alt-source" maxLength={LIMITS.source} placeholder="MCC Circular No. 114/2026" value={values.source} onChange={(e) => setValues({ ...values, source: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" disabled={pending || !valid}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Add alternative (unverified)
        </Button>
      </div>
    </form>
  );
}

export function ArrangementActions({
  arrangementId,
  updatedAt,
  preview,
  eventVerified,
}: {
  arrangementId: string;
  updatedAt: string;
  preview: string;
  eventVerified: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const send = (decision: "VERIFIED" | "UNAVAILABLE") =>
    startTransition(async () => {
      const res = await apiCall<{ dispatch: Dispatch }>(`/api/arrangements/${arrangementId}/verify`, {
        method: "POST",
        body: { expectedUpdatedAt: updatedAt, decision },
      });
      if (res.ok) {
        toast.success(decision === "VERIFIED" ? dispatchMessage("Alternative verified.", res.data.dispatch) : "Alternative marked as unavailable.");
        setOpen(false);
      }
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" disabled={!eventVerified} title={eventVerified ? undefined : "Verify the notice first"}>
            <ShieldCheck aria-hidden /> Verify alternative
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify this alternative arrangement?</DialogTitle>
            <DialogDescription>Citizens in the ward receive this message immediately (as a follow-up if they were already alerted).</DialogDescription>
          </DialogHeader>
          <MessagePreview label="Message citizens will receive" message={preview} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => send("VERIFIED")} disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
              Verify and notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => window.confirm("Mark this alternative as unavailable (could not be confirmed)?") && send("UNAVAILABLE")}>
        <CircleSlash aria-hidden /> Could not confirm
      </Button>
    </div>
  );
}
