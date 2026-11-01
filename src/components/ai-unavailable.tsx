import { CloudOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Calm, visible notice for degraded (template-only) mode. */
export function AiUnavailableNotice({ message }: { message: string }) {
  return (
    <Alert variant="muted">
      <CloudOff aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
