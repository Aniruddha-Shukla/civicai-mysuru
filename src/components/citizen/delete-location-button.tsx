"use client";

import { LoaderCircle, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function DeleteLocationButton({ complaintId }: { complaintId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetch(`/api/complaints/${complaintId}/location`, { method: "DELETE" });
          if (!res.ok) {
            toast.error(t("common.requestFailed"));
            return;
          }
          toast.success(t("tracker.locationDeleted"));
          router.refresh();
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Trash aria-hidden />}
      {t("tracker.deleteLocation")}
    </Button>
  );
}
