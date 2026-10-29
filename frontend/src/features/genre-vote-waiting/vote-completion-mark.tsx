"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Check } from "lucide-react";
import { CELEBRATION, CONFETTI_COLORS, CONFETTI_PIECES } from "./celebration-config";
import styles from "./genre-vote-waiting.module.css";

type CelebrationStyle = CSSProperties & {
  "--celebration-duration": string;
  "--halo-delay": string;
  "--halo-cycle": string;
  "--halo-min-scale": string;
  "--halo-max-scale": string;
};
type ConfettiStyle = CSSProperties & {
  "--confetti-size": string;
  "--confetti-start-x": string;
  "--confetti-start-y": string;
  "--confetti-x": string;
  "--confetti-rise": string;
  "--confetti-fall": string;
  "--confetti-sway": string;
  "--confetti-rotation": string;
  "--confetti-delay": string;
  "--confetti-duration": string;
  "--confetti-color": string;
};

export function VoteCompletionMark() {
  const [showConfetti, setShowConfetti] = useState<boolean>(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const removeConfetti = () => setShowConfetti(false);
    const handlePreference = () => { if (preference.matches) removeConfetti(); };
    const timer = window.setTimeout(removeConfetti, preference.matches ? 0 : CELEBRATION.duration + CELEBRATION.cleanupGrace);
    preference.addEventListener("change", handlePreference);
    return () => {
      window.clearTimeout(timer);
      preference.removeEventListener("change", handlePreference);
    };
  }, []);

  const style: CelebrationStyle = {
    "--celebration-duration": `${CELEBRATION.duration}ms`,
    "--halo-delay": `${CELEBRATION.haloDelay}ms`,
    "--halo-cycle": `${CELEBRATION.haloCycle}ms`,
    "--halo-min-scale": String(CELEBRATION.haloMinScale),
    "--halo-max-scale": String(CELEBRATION.haloMaxScale),
  };

  return (
    <div className={styles.successRing} style={style} aria-hidden="true" data-completion-mark>
      <span className={styles.successMark} data-success-mark><Check strokeWidth={2.2} /></span>
      {showConfetti && (
        <div className={styles.confettiLayer} data-confetti-layer onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setShowConfetti(false);
        }}>
          {CONFETTI_PIECES.map((piece, index) => {
            const pieceStyle: ConfettiStyle = {
              "--confetti-size": `${piece.size}px`,
              "--confetti-start-x": `${piece.startX}px`,
              "--confetti-start-y": `${piece.startY}px`,
              "--confetti-x": `${piece.x}px`,
              "--confetti-rise": `${piece.rise}px`,
              "--confetti-fall": `${piece.fall}px`,
              "--confetti-sway": `${piece.sway}px`,
              "--confetti-rotation": `${piece.rotation}deg`,
              "--confetti-delay": `${piece.delay}ms`,
              "--confetti-duration": `${piece.duration}ms`,
              "--confetti-color": CONFETTI_COLORS[piece.color],
            };
            return <i key={index} className={styles.confettiPiece} data-shape={piece.shape} data-color={piece.color} style={pieceStyle} />;
          })}
        </div>
      )}
    </div>
  );
}
