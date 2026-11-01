import "server-only";
import { cookies } from "next/headers";
import { getSessionProfile } from "@/lib/auth";
import { normalizeLang, type Lang } from "@/lib/i18n";

export const LANG_COOKIE = "civicai_lang";

/** Signed-in users: their profile language. Visitors: the language cookie. */
export async function currentLang(): Promise<Lang> {
  try {
    const profile = await getSessionProfile();
    if (profile) return normalizeLang(profile.language);
  } catch {
    // Auth/DB unavailable — fall back to the cookie so public pages still render.
  }
  return normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
}
