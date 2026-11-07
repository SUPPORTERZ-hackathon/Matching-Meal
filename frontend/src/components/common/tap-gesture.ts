export type TapMetrics = {
  dx: number;
  dy: number;
  elapsedMs: number;
  sinceScrollMs: number;
  sinceBurstMs: number;
  scrollChanged: boolean;
  reducedMotion: boolean;
  activeBursts: number;
};

const MOVE_LIMIT_PX = 10;
const TAP_TIME_LIMIT_MS = 500;
const SCROLL_QUIET_MS = 180;
const BURST_COOLDOWN_MS = 90;
export const MAX_BURSTS = 6;

export function shouldEmitTap(metrics: TapMetrics): boolean {
  return !metrics.reducedMotion && !metrics.scrollChanged && metrics.activeBursts < MAX_BURSTS
    && Math.hypot(metrics.dx, metrics.dy) < MOVE_LIMIT_PX
    && metrics.elapsedMs <= TAP_TIME_LIMIT_MS
    && metrics.sinceScrollMs >= SCROLL_QUIET_MS
    && metrics.sinceBurstMs >= BURST_COOLDOWN_MS;
}
