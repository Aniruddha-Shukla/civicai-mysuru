"use client";

import { useEffect } from "react";

/**
 * One small, page-wide driver for every interactive effect, so pages can stay server components
 * and just opt in with data attributes:
 *
 *   data-reveal      fade/rise into view when scrolled to (stagger with style --i)
 *   data-spotlight   sets --mx/--my so the .spotlight glow follows the pointer
 *   data-magnetic    element leans toward the pointer while hovered
 *   data-tilt        3D tilt toward the pointer (+ --mx/--my for a .glare layer)
 *   data-parallax    sets --px/--py in [-1, 1] for .plx layers inside it
 *
 * Pointer effects run only with a fine pointer (mouse/trackpad); movement is skipped when the
 * person prefers reduced motion. Reveal content is always shown if motion is reduced.
 */
export function PointerFx() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Scroll reveal ────────────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => {
        if (reduceMotion) el.setAttribute("data-shown", "");
        else io.observe(el);
      });
    };
    scan();
    let scanQueued = false;
    const mo = new MutationObserver(() => {
      if (scanQueued) return;
      scanQueued = true;
      requestAnimationFrame(() => {
        scanQueued = false;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    if (!finePointer) {
      return () => {
        io.disconnect();
        mo.disconnect();
      };
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
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return null;
}
