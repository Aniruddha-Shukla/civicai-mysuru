import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const COMPLAINT_PHOTO_BUCKET = "complaint-photos";

/**
 * Service-role client. SERVER ONLY — the key bypasses row-level security and is
 * never exposed with a NEXT_PUBLIC_ prefix. Used for private photo storage.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
