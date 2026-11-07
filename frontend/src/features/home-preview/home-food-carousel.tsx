"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Genre } from "../genre-vote/genres";
import { getCarouselSlot, getCarouselSwipeStep } from "./home-food-data";
import { HomeFoodPhoto } from "./home-food-photo";

const INITIAL_ACTIVE_INDEX = 1;
const AUTO_ADVANCE_MS = 4000;
const MANUAL_PAUSE_MS = 10000;

type HomeFoodCarouselProps = { genres: readonly (Genre | undefined)[] };
type PointerStart = { id: number; x: number; y: number };

export function HomeFoodCarousel({ genres }: HomeFoodCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(INITIAL_ACTIVE_INDEX);
  const heroRef = useRef<HTMLElement>(null);
  const pointerStart = useRef<PointerStart | null>(null);
  const pauseUntil = useRef(0);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    function updateTimer() {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (motion.matches || document.hidden || !inView || genres.length < 2) return;
      timer = setInterval(() => {
        if (Date.now() >= pauseUntil.current) setActiveIndex((index) => (index + 1) % genres.length);
      }, AUTO_ADVANCE_MS);
    }

    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updateTimer(); }, { threshold: 0.2 })
      : undefined;
    observer?.observe(hero);
    document.addEventListener("visibilitychange", updateTimer);
    motion.addEventListener("change", updateTimer);
    updateTimer();
    return () => {
      if (timer) clearInterval(timer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateTimer);
      motion.removeEventListener("change", updateTimer);
    };
  }, [genres]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId || genres.length < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const step = getCarouselSwipeStep(dx, dy);
    if (!step) return;
    pauseUntil.current = Date.now() + MANUAL_PAUSE_MS;
    setActiveIndex((index) => (index + step + genres.length) % genres.length);
  }

  return <section ref={heroRef} className="home-preview-hero" aria-label="料理のイメージ" aria-roledescription="カルーセル" aria-live="off"
    onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; }}>
    {genres.map((genre, index) => {
      const slot = getCarouselSlot(index, activeIndex, genres.length);
      return <div key={genre?.id ?? index} className="home-preview-food" data-slot={slot} data-home-genre={genre?.id} aria-hidden={slot !== 0}>
        <HomeFoodPhoto genre={genre} featured />
        <span className="home-preview-food-name">{genre?.name ?? "料理"}</span>
        <span className="home-preview-heart" aria-hidden="true">♥</span>
      </div>;
    })}
  </section>;
}
