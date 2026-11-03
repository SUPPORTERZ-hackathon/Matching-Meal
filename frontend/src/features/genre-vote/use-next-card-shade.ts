"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { cardExitDistance, nextCardShadeOpacity } from "./deck-presentation";
import type { VotePhase } from "./use-genre-vote";

type NextCardShadeOptions = {
  cardRef: RefObject<HTMLElement | null>;
  clipRef: RefObject<HTMLDivElement | null>;
  genreId?: string;
  phase: VotePhase;
  motionX: number;
  reducedMotion: boolean;
};

export function useNextCardShade({ cardRef, clipRef, genreId, phase, motionX, reducedMotion }: NextCardShadeOptions) {
  const shadeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let frame: number | null = null;
    const transitioning = !reducedMotion && (phase === "exiting" || phase === "returning");

    function updateShade() {
      const card = cardRef.current;
      const clip = clipRef.current;
      const shade = shadeRef.current;
      const stage = card?.parentElement;
      if (!card || !clip || !shade || !stage) return false;
      if (reducedMotion && phase === "exiting") {
        shade.style.opacity = "0";
        return false;
      }
      // motion.xは退場の最終目標へ即座に変わるため、補間中の実描画位置を読む。
      const transform = getComputedStyle(card).transform;
      const matrix = transform === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform);
      const distance = matrix.m41;
      const bounds = clip.getBoundingClientRect();
      const exitDistance = cardExitDistance({
        cardWidth: card.offsetWidth, cardHeight: card.offsetHeight,
        centerX: stage.getBoundingClientRect().left + card.offsetLeft + card.offsetWidth / 2,
        clipLeft: bounds.left, clipRight: bounds.right,
        rotationDegrees: Math.atan2(matrix.m12, matrix.m11) * 180 / Math.PI,
      }, distance < 0 ? -1 : 1);
      shade.style.opacity = String(nextCardShadeOpacity(distance, card.offsetWidth, exitDistance));
      return true;
    }

    function sample() {
      frame = null;
      if (updateShade() && transitioning) frame = requestAnimationFrame(sample);
    }

    sample();
    window.addEventListener("resize", updateShade);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateShade);
    };
  }, [cardRef, clipRef, genreId, phase, motionX, reducedMotion]);

  return shadeRef;
}
