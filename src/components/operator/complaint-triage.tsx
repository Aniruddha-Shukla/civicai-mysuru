"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { apiCall } from "@/lib/client-api";
import { COMPLAINT_STATUSES, LIMITS } from "@/lib/constants";

const LABELS = { open: "Open", in_review: "In review", resolved: "Resolved", rejected: "Closed without action" } as const;

export function ComplaintTriage({ id, status, note, updatedAt }: { id: string; status: string; note: string | null; updatedAt: string }) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [nextNote, setNextNote] = useState(note ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = nextStatus !== status || nextNote !== (note ?? "");

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await apiCall(`/api/complaints/${id}`, {
            method: "PATCH",
            body: { status: nextStatus, operatorNote: nextNote.trim() || undefined, expectedUpdatedAt: updatedAt },
          });
          if (res.ok) toast.success("Complaint updated.");
          router.refresh();
        });
      }}
    >
      <NativeSelect value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="sm:w-44" aria-label="Status">
        {COMPLAINT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
          </option>
        ))}
      </NativeSelect>
      <Input value={nextNote} maxLength={LIMITS.operatorNote} onChange={(e) => setNextNote(e.target.value)} placeholder="Note visible to the citizen" aria-label="Note" />
      <Button type="submit" variant="secondary" disabled={pending || !dirty}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        Save
      </Button>
    </form>
  );
}
