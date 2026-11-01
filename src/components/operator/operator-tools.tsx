"use client";

import { LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiCall } from "@/lib/client-api";

export function OperatorTools() {
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const [resetting, startReset] = useTransition();

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        variant="outline"
        disabled={syncing}
        onClick={() =>
          startSync(async () => {
            const result = await apiCall<{ notificationsCreated: number; expiredEvents: number; eventsProcessed: number }>("/api/operator/run-sync", { method: "POST" });
            if (result.ok) {
              toast.success(
                `Sync complete: ${result.data.notificationsCreated} notification(s) sent, ${result.data.expiredEvents} notice(s) archived, ${result.data.eventsProcessed} changed notice(s) processed.`,
              );
              router.refresh();
            }
          })
        }
      >
        {syncing ? <LoaderCircle className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
        Run scheduled sync now
      </Button>
      <Button
        variant="ghost"
        disabled={resetting}
        onClick={() =>
          startReset(async () => {
            if (!window.confirm("Re-create the demo scenarios (A–F) with dates relative to today? Only demo records are changed.")) return;
            const result = await apiCall<{ mondayA: string }>("/api/operator/demo-refresh", { method: "POST" });
            if (result.ok) {
              toast.success(`Demo scenarios refreshed (Scenario A: Monday ${result.data.mondayA}).`);
              router.refresh();
            }
          })
        }
      >
        {resetting ? <LoaderCircle className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
        Refresh demo scenarios
      </Button>
    </div>
  );
}
