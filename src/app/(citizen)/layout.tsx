import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Citizen area: signed-in CITIZEN accounts only (enforced on the server, not just in the UI). */
export default async function CitizenLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role === "OPERATOR") redirect("/operator");
  return children;
}
