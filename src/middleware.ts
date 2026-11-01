import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Pages only. API routes authenticate (and authorise) themselves and answer with JSON 401/403.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
