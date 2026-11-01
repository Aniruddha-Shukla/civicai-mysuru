import { Badge } from "@/components/ui/badge";
import type { ComplaintStatus } from "@/lib/constants";

const VARIANT: Record<ComplaintStatus, "secondary" | "unverified" | "verified" | "unavailable"> = {
  open: "secondary",
  in_review: "unverified",
  resolved: "verified",
  rejected: "unavailable",
};

export function ComplaintStatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge variant={VARIANT[status as ComplaintStatus] ?? "secondary"}>{label}</Badge>;
}
