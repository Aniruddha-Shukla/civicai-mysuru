"use client";

import { toast } from "sonner";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** fetch wrapper for client components: JSON in/out, friendly toast on failure. */
export async function apiCall<T>(url: string, init: { method: string; body?: unknown }): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = (await res.json().catch(() => null)) as (T & { error?: ApiError }) | null;
    if (!res.ok) {
      const error = data?.error ?? { code: "HTTP_ERROR", message: "The request failed. Please try again." };
      toast.error(error.message);
      return { ok: false, error };
    }
    return { ok: true, data: data as T };
  } catch {
    const error = { code: "NETWORK", message: "Network error. Please check your connection and try again." };
    toast.error(error.message);
    return { ok: false, error };
  }
}
