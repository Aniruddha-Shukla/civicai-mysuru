"use client";

import { useEffect } from "react";

/**
 * One small, page-wide driver for every interactive effect, so pages can stay server components
 * and just opt in with data attributes:
 *
 *   (data-reveal is pure CSS — scroll-driven animations in globals.css)
 *   data-spotlight   sets --mx/--my so the .spotlight glow follows the pointer
 *   data-magnetic    element leans toward the pointer while hovered
 *   data-tilt        3D tilt toward the pointer (+ --mx/--my for a .glare layer)
 *   data-parallax    sets --px/--py in [-1, 1] for .plx layers inside it
 *
 * Pointer effects run only with a fine pointer (mouse/trackpad); movement is skipped when the
 * person prefers reduced motion.
 */
export function PointerFx() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


    // ── Scroll-linked progress (--p from 0 to 1) for 3D scroll effects ──
    //   data-scroll="enter"  0 as the element comes up from the bottom → 1 once its top reaches ~30% of the screen
    //   data-scroll="exit"   0 while the element is in place → 1 once it has scrolled fully out of the top
    //   data-scroll="page"   how far down the whole page you are
    // Reduced motion: never set, so the CSS fallbacks (finished state) apply.
    let scrollFrame = 0;
    const visible = new Set<HTMLElement>();
    const sio = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target as HTMLElement);
        else visible.delete(e.target as HTMLElement);
      }
      queueScroll();
    });
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const updateScroll = () => {
      scrollFrame = 0;
      const vh = window.innerHeight;
      for (const el of visible) {
        if (!el.isConnected) {
          visible.delete(el);
          continue;
        }
        const mode = el.dataset.scroll;
        let p: number;
        if (mode === "page") {
          const max = document.documentElement.scrollHeight - vh;
          p = max > 0 ? window.scrollY / max : 0;
        } else {
          const r = el.getBoundingClientRect();
          p = mode === "exit" ? clamp(-r.top / Math.max(1, r.height)) : clamp((vh * 0.92 - r.top) / (vh * 0.62));
        }
        el.style.setProperty("--p", p.toFixed(4));
      }
    };
    function queueScroll() {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
    }
    const scanScroll = () => {
      if (reduceMotion) return;
      document.querySelectorAll<HTMLElement>("[data-scroll]:not([data-scroll-bound])").forEach((el) => {
        el.setAttribute("data-scroll-bound", "");
        // The page bar is always "visible"; everything else is tracked only while on screen.
        if (el.dataset.scroll === "page") visible.add(el);
        else sio.observe(el);
      });
      queueScroll();
    };
    scanScroll();
    const mo2 = new MutationObserver(() => requestAnimationFrame(scanScroll));
    mo2.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", queueScroll, { passive: true });
    window.addEventListener("resize", queueScroll);
    const stopScroll = () => {
      sio.disconnect();
      mo2.disconnect();
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", queueScroll);
      window.removeEventListener("resize", queueScroll);
    };

    if (!finePointer) {
      return stopScroll;
    }

    // ── Pointer effects ──────────────────────────────────────────────
    let frame = 0;
    let last: PointerEvent | null = null;
    let magnetic: HTMLElement | null = null;
    let tilt: HTMLElement | null = null;
    let parallax: HTMLElement | null = null;

    const reset = (el: HTMLElement | null) => {
      if (el) el.style.transform = "";
    };

    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const target = e.target instanceof Element ? e.target : null;

      const spot = target?.closest<HTMLElement>("[data-spotlight],[data-tilt]");
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty("--mx", `${e.clientX - r.left}px`);
        spot.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
      if (reduceMotion) return;

      const mag = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (mag !== magnetic) {
        reset(magnetic);
        magnetic = mag;
      }
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
        mag.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      }

      const tl = target?.closest<HTMLElement>("[data-tilt]") ?? null;
      if (tl !== tilt) {
        reset(tilt);
        tilt = tl;
      }
      if (tl) {
        const r = tl.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        const max = Number(tl.dataset.tilt) || 6;
        tl.style.transform = `perspective(1000px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
      }

      const px = target?.closest<HTMLElement>("[data-parallax]") ?? null;
      if (px !== parallax) {
        parallax?.style.setProperty("--px", "0");
        parallax?.style.setProperty("--py", "0");
        parallax = px;
      }
      if (px) {
        const r = px.getBoundingClientRect();
        px.style.setProperty("--px", (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
        px.style.setProperty("--py", (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
      }
    };

    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      reset(magnetic);
      reset(tilt);
      parallax?.style.setProperty("--px", "0");
      parallax?.style.setProperty("--py", "0");
      magnetic = tilt = parallax = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      stopScroll();
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return null;
}
