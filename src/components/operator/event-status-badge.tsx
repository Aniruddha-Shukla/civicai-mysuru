import { Badge } from "@/components/ui/badge";

const VARIANT = { ACTIVE: "default", RESOLVED: "verified", EXPIRED: "unavailable", WITHDRAWN: "destructive" } as const;

export function EventStatusBadge({ status }: { status: keyof typeof VARIANT }) {
  return <Badge variant={VARIANT[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
