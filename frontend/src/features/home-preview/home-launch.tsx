"use client";

import { Heart } from "lucide-react";
import { AppLogo } from "@/components/common/app-logo";

export type HomeLaunchPhase = "ready" | "playing" | "leaving" | "settling";
type HomeLaunchProps = { phase: HomeLaunchPhase; onSkip: () => void };

export function HomeLaunch({ phase, onSkip }: HomeLaunchProps) {
  if (phase === "ready" || phase === "settling") return null;
  return <div className="home-launch" data-phase={phase} role="dialog" aria-modal="true" aria-label="メシマッチを起動しています" data-tap-particles="off">
    <div className="home-launch-center">
      <span className="home-launch-glow" aria-hidden="true" />
      <Heart className="home-launch-heart home-launch-heart-one" aria-hidden="true" fill="currentColor" />
      <Heart className="home-launch-heart home-launch-heart-two" aria-hidden="true" fill="currentColor" />
      <span className="home-launch-spark" aria-hidden="true" />
      <AppLogo className="home-launch-logo" />
      <p>今日の「食べたい」を、みんなで。</p>
    </div>
    <button type="button" className="home-launch-skip" onClick={onSkip} autoFocus>スキップ</button>
  </div>;
}
