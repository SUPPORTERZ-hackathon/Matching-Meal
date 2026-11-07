"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { shouldEmitTap } from "./tap-gesture";
import "./tap-particles.css";

const BURST_LIFETIME_MS = 640;
const PARTICLE_STAGGER_MS = 8;
const NORMAL_PARTICLES = 5;
const ACCENT_PARTICLES = 8;
const COLORS = ["#ed3b33", "#f19289", "#ffd1cb", "#ef9f6d", "#f2c783"] as const;
const SHAPES = ["heart", "dot", "star", "dot", "heart"] as const;

type PointerStart = { id: number; x: number; y: number; time: number; scrollX: number; scrollY: number };

function isTextInput(element: Element | null): boolean {
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
}

function isExcluded(element: Element | null): boolean {
  return Boolean(element?.closest("[data-tap-particles='off'], [role='dialog'], [aria-modal='true'], button:disabled, [aria-disabled='true'], input, textarea, select, [contenteditable='true']"));
}

export function TapParticles() {
  const layerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bursts = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    let start: PointerStart | null = null;
    let lastScroll = -Infinity;
    let lastBurst = -Infinity;

    function clearBursts() {
      for (const [burst, timer] of bursts) { clearTimeout(timer); burst.remove(); }
      bursts.clear();
    }

    function onDown(event: PointerEvent) {
      start = null;
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || motion.matches || isTextInput(document.activeElement)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isExcluded(target)) return;
      start = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), scrollX: window.scrollX, scrollY: window.scrollY };
    }

    function onScroll() { lastScroll = performance.now(); start = null; }

    function onUp(event: PointerEvent) {
      const tap = start;
      start = null;
      if (!tap || tap.id !== event.pointerId || motion.matches || isTextInput(document.activeElement)) return;
      const now = performance.now();
      const dx = event.clientX - tap.x, dy = event.clientY - tap.y;
      if (!shouldEmitTap({ dx, dy, elapsedMs: now - tap.time, sinceScrollMs: now - lastScroll, sinceBurstMs: now - lastBurst,
        scrollChanged: window.scrollX !== tap.scrollX || window.scrollY !== tap.scrollY, reducedMotion: motion.matches, activeBursts: bursts.size })) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isExcluded(target)) return;
      const count = target?.closest("[data-tap-particles='accent']") ? ACCENT_PARTICLES : NORMAL_PARTICLES;
      const burst = document.createElement("span");
      burst.className = "meal-tap-burst";
      burst.style.left = `${event.clientX}px`;
      burst.style.top = `${event.clientY}px`;
      for (let index = 0; index < count; index += 1) {
        const particle = document.createElement("span");
        particle.className = "meal-tap-particle";
        particle.style.setProperty("--particle-color", COLORS[index % COLORS.length]);
        const angle = (index / count) * Math.PI * 2 + (Math.random() - .5) * .35;
        const distance = 22 + Math.random() * 22;
        particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--dy", `${Math.sin(angle) * distance - 6}px`);
        particle.style.setProperty("--turn", `${(Math.random() - .5) * 70}deg`);
        particle.style.animationDelay = `${index * PARTICLE_STAGGER_MS}ms`;
        const shape = document.createElement("span");
        shape.className = "meal-tap-shape";
        shape.dataset.shape = SHAPES[index % SHAPES.length];
        particle.append(shape);
        burst.append(particle);
      }
      layer?.append(burst);
      lastBurst = now;
      const timer = setTimeout(() => { burst.remove(); bursts.delete(burst); }, BURST_LIFETIME_MS);
      bursts.set(burst, timer);
    }

    function onMotionChange() { if (motion.matches) clearBursts(); }
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onScroll, true);
    window.addEventListener("scroll", onScroll, true);
    motion.addEventListener("change", onMotionChange);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onScroll, true);
      window.removeEventListener("scroll", onScroll, true);
      motion.removeEventListener("change", onMotionChange);
      clearBursts();
    };
  }, [pathname]);

  return <div ref={layerRef} className="meal-tap-layer" aria-hidden="true" />;
}
