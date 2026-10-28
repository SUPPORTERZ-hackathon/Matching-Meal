export const SWIPE = {
  axisLockDistance: 10,
  axisDominanceRatio: 1.2,
  commitWidthRatio: 0.25,
  maxRotationDegrees: 12,
  verticalFollowRatio: 0.18,
  maxVerticalOffset: 22,
  exitMargin: 32,
  returnDuration: 300,
  exitDuration: 280,
  enterDuration: 240,
  undoDuration: 200,
  animationEventGrace: 80,
} as const;

export type GestureAxis = "pending" | "horizontal" | "vertical";
export type CardMotion = { x: number; y: number; rotation: number };
export const REST_MOTION: CardMotion = { x: 0, y: 0, rotation: 0 };

export function detectAxis(x: number, y: number): GestureAxis {
  if (Math.hypot(x, y) < SWIPE.axisLockDistance) return "pending";
  if (Math.abs(x) > Math.abs(y) * SWIPE.axisDominanceRatio) return "horizontal";
  if (Math.abs(y) > Math.abs(x) * SWIPE.axisDominanceRatio) return "vertical";
  return "pending";
}

export function canCommitSwipe(x: number, y: number, width: number): boolean {
  return width > 0 && Math.abs(x) >= width * SWIPE.commitWidthRatio
    && Math.abs(x) >= Math.abs(y) * SWIPE.axisDominanceRatio;
}

export function dragMotion(x: number, y: number, width: number, reducedMotion: boolean): CardMotion {
  return {
    x,
    y: Math.max(-SWIPE.maxVerticalOffset, Math.min(y * SWIPE.verticalFollowRatio, SWIPE.maxVerticalOffset)),
    rotation: reducedMotion || width <= 0 ? 0 : Math.max(-SWIPE.maxRotationDegrees,
      Math.min(x / width * SWIPE.maxRotationDegrees, SWIPE.maxRotationDegrees)),
  };
}

export function directionOpacity(x: number, width: number): number {
  return width <= 0 ? 0 : Math.min(Math.abs(x) / (width * SWIPE.commitWidthRatio), 1);
}
