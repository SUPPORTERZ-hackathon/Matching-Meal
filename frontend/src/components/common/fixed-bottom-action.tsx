"use client";

import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "cn";

type FixedBottomActionProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };
const ACTION_HEIGHT = "--meal-fixed-action-height";
const VIEWPORT_GAP = "--meal-viewport-bottom-gap";
const FOCUS_GAP = 12;

export function FixedBottomAction({ children, className, ...props }: FixedBottomActionProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const action = ref.current;
    const page = action?.closest<HTMLElement>(".meal-page");
    if (!action || !page) return;
    let frame: number | undefined;
    let previousHeight = -1, previousGap = -1;
    function measure() {
      frame = undefined;
      if (!action || !page) return;
      const viewport = window.visualViewport;
      const gap = viewport && viewport.scale === 1 ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      const height = Math.ceil(action.getBoundingClientRect().height);
      if (height !== previousHeight) { page.style.setProperty(ACTION_HEIGHT, `${height}px`); previousHeight = height; }
      if (gap !== previousGap) { page.style.setProperty(VIEWPORT_GAP, `${gap}px`); previousGap = gap; }
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !page.contains(field) || !field.matches("input, textarea, select, [contenteditable=true]")) return;
      const header = page.querySelector<HTMLElement>(".meal-header[data-sticky=true]");
      const top = Math.max(viewport?.offsetTop ?? 0, header?.getBoundingClientRect().bottom ?? 0) + FOCUS_GAP;
      const bottom = action.getBoundingClientRect().top - FOCUS_GAP;
      const rect = field.getBoundingClientRect();
      if (bottom - top < rect.height) return;
      const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0;
      if (delta) window.scrollBy({ top: delta, behavior: "instant" });
    }
    function schedule() { if (frame === undefined) frame = window.requestAnimationFrame(measure); }
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(action, { box: "border-box" });
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      page.style.removeProperty(ACTION_HEIGHT);
      page.style.removeProperty(VIEWPORT_GAP);
    };
  }, []);
  return <><div className="meal-fixed-action-spacer" aria-hidden="true" /><div {...props} ref={ref} className={cn("meal-fixed-action", className)} data-fixed-action>{children}</div></>;
}
