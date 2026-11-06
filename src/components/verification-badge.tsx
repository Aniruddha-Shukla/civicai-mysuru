import { CircleSlash, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getT, type Lang } from "@/lib/i18n";
import type { VerificationStatus } from "@/lib/verification";

const ICONS = { VERIFIED: ShieldCheck, UNVERIFIED: TriangleAlert, UNAVAILABLE: CircleSlash } as const;
const VARIANTS = { VERIFIED: "verified", UNVERIFIED: "unverified", UNAVAILABLE: "unavailable" } as const;
const HELP = { VERIFIED: "status.verifiedHelp", UNVERIFIED: "status.unverifiedHelp", UNAVAILABLE: "status.unavailableHelp" } as const;

/**
 * One of exactly three first-class visual states (paper §6.2) — never a hidden/null case.
 * Citizens see plain words ("Confirmed by the city"); operators see the technical state.
 */
export function VerificationBadge({
  status,
  lang = "en",
  audience = "operator",
  className,
}: {
  status: VerificationStatus;
  lang?: Lang;
  audience?: "citizen" | "operator";
  className?: string;
}) {
  const t = getT(lang);
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className={className} title={t(HELP[status])}>
      <Icon aria-hidden />
      {audience === "citizen" ? t(`event.trust.${status}`) : t(`status.${status}`)}
    </Badge>
  );
}
