import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({ label }: { label: string }) {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" aria-label={label}>
        <LogOut aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </Button>
    </form>
  );
}
