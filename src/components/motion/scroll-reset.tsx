"use client";

import { useEffect } from "react";

const KEY = "civicai:fresh-sign-in";

/** Called just before signing in: the next signed-in page should open at the top. */
export function markFreshSignIn() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // storage blocked (private mode): nothing to do, the page just keeps its scroll position
  }
}

/**
 * After the sign-in redirect the browser keeps the sign-in page's scroll position, which would
 * land people halfway down their home screen. Mounted once in the signed-in layouts.
 */
export function ScrollReset() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) {
        sessionStorage.removeItem(KEY);
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    } catch {
      // ignore
    }
  }, []);
  return null;
}
