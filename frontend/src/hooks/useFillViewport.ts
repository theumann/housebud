"use client";

import { useEffect, useState } from "react";

// The height that makes an element fill the rest of the screen below where it
// starts, minus `bottomGap` px, so a chat fits the window without the page
// scrolling. What sits above it varies (demo banner, invitations, household
// switcher, a wrapping title), so it's measured rather than guessed, and
// measured again when the window or the page above it changes size. Apply it
// as `style={{ height }}`: Tailwind can't express a measured value.
//
// Returns [measure, height]: pass `measure` as the element's ref (a callback,
// since the element can appear later, e.g. after a module comes back on).
// `height` is undefined until measured.
export function useFillViewport<T extends HTMLElement>(
  bottomGap: number,
  minHeight = 320,
) {
  const [el, setEl] = useState<T | null>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(minHeight, window.innerHeight - top - bottomGap));
    };
    // The observer also calls fit once as soon as it starts observing.
    const observer = new ResizeObserver(fit);
    observer.observe(document.body);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [el, bottomGap, minHeight]);

  return [setEl, height] as const;
}
