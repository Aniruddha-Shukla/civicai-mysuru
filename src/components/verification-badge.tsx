import { CircleSlash, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getT, type Lang } from "@/lib/i18n";
import type { VerificationStatus } from "@/lib/verification";

const ICONS = { VERIFIED: ShieldCheck, UNVERIFIED: TriangleAlert, UNAVAILABLE: CircleSlash } as const;
const VARIANTS = { VERIFIED: "verified", UNVERIFIED: "unverified", UNAVAILABLE: "unavailable" } as const;

/** One of exactly three first-class visual states (paper §6.2) — never a hidden/null case. */
export function VerificationBadge({ status, lang = "en", className }: { status: VerificationStatus; lang?: Lang; className?: string }) {
  const t = getT(lang);
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className={className} title={t(`status.${status === "VERIFIED" ? "verifiedHelp" : status === "UNVERIFIED" ? "unverifiedHelp" : "unavailableHelp"}`)}>
      <Icon aria-hidden />
      {t(`status.${status}`)}
    </Badge>
  );
}
