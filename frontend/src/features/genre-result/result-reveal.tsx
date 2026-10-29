"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Heart } from "lucide-react";
import type { Genre } from "../genre-vote/genres";
import { RESULT_REVEAL, RESULT_BURST_COLORS, RESULT_BURST_PIECES } from "./reveal-config";
import { ResultArtwork } from "./result-artwork";
import styles from "./genre-result.module.css";

type ResultRevealProps = { genre: Genre };
type RevealStyle = CSSProperties & { "--result-pop-duration": string; "--result-burst-duration": string };
type BurstStyle = CSSProperties & {
  "--burst-x": string; "--burst-y": string; "--burst-rotation": string;
  "--burst-size": string; "--burst-color": string; "--burst-delay": string; "--burst-duration": string;
};

export function ResultReveal({ genre }: ResultRevealProps) {
  const [showBurst, setShowBurst] = useState<boolean>(true);
  const timerRef = useRef<number | null>(null);
  const removeBurst = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setShowBurst(false);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handlePreference = () => { if (preference.matches) removeBurst(); };
    timerRef.current = window.setTimeout(removeBurst, preference.matches ? 0 : RESULT_REVEAL.burstDuration + RESULT_REVEAL.cleanupGrace);
    preference.addEventListener("change", handlePreference);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      preference.removeEventListener("change", handlePreference);
    };
  }, [removeBurst]);

  const style: RevealStyle = { "--result-pop-duration": `${RESULT_REVEAL.imageDuration}ms`, "--result-burst-duration": `${RESULT_REVEAL.burstDuration}ms` };
  return (
    <div className={styles.revealStage} style={style} data-result-reveal>
      <div className={styles.popImage} data-result-pop>
        <ResultArtwork key={`${genre.id}:${genre.imagePath ?? "none"}`} genre={genre} />
        <span className={styles.heartBadge} aria-hidden="true" data-result-heart><Heart fill="currentColor" strokeWidth={0} focusable="false" /></span>
      </div>
      {showBurst && <div className={styles.burstLayer} aria-hidden="true" data-result-burst onAnimationEnd={(event) => { if (event.target === event.currentTarget) removeBurst(); }}>
        {RESULT_BURST_PIECES.map((piece, index) => {
          const pieceStyle: BurstStyle = {
            "--burst-x": String(piece.x), "--burst-y": String(piece.y), "--burst-rotation": `${piece.rotation}deg`,
            "--burst-size": `${piece.size}px`, "--burst-color": RESULT_BURST_COLORS[piece.color],
            "--burst-delay": `${piece.delay}ms`, "--burst-duration": `${piece.duration}ms`,
          };
          return <i key={index} className={styles.burstPiece} style={pieceStyle} data-shape={piece.shape} data-color={piece.color} />;
        })}
      </div>}
    </div>
  );
}
