"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/**
 * Fades its content up once it scrolls into view (styles in globals.css).
 * Server HTML is always visible: only content still below the fold when the page
 * hydrates is hidden and then revealed, and `prefers-reduced-motion` turns it off.
 * `index` staggers siblings by 80 ms each.
 */
export function Reveal({ index = 0, style, ...props }: ComponentProps<"div"> & { index?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: leave it be

    el.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    // Printing never scrolls, so show everything first.
    const show = () => {
      el.dataset.reveal = "shown";
      observer.disconnect();
    };
    window.addEventListener("beforeprint", show);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", show);
    };
  }, []);

  return <div ref={ref} style={{ ...style, ["--index" as string]: index }} {...props} />;
}
