import { CONFETTI_COLORS } from "../genre-vote-waiting/celebration-config";

export const RESULT_REVEAL = { imageDuration: 850, burstDuration: 1600, cleanupGrace: 100 } as const;
export { CONFETTI_COLORS as RESULT_BURST_COLORS };

type ResultBurstPiece = {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly size: number;
  readonly shape: "circle" | "square" | "rectangle";
  readonly color: keyof typeof CONFETTI_COLORS;
  readonly delay: number;
  readonly duration: number;
};

// 結果発表用の放射状軌道。待機画面の落下演出とは分けて管理する。
export const RESULT_BURST_PIECES: readonly ResultBurstPiece[] = [
  { x: 0, y: -.96, rotation: 120, size: 9, shape: "square", color: "yellow", delay: 0, duration: 1490 },
  { x: .40, y: -.86, rotation: -150, size: 8, shape: "circle", color: "pink", delay: 40, duration: 1440 },
  { x: .72, y: -.65, rotation: 190, size: 10, shape: "rectangle", color: "blue", delay: 20, duration: 1480 },
  { x: .94, y: -.31, rotation: -130, size: 9, shape: "circle", color: "red", delay: 60, duration: 1450 },
  { x: .97, y: .10, rotation: 160, size: 8, shape: "square", color: "orange", delay: 10, duration: 1500 },
  { x: .80, y: .49, rotation: -190, size: 9, shape: "rectangle", color: "yellow", delay: 90, duration: 1410 },
  { x: .50, y: .79, rotation: 140, size: 8, shape: "circle", color: "blue", delay: 30, duration: 1500 },
  { x: .12, y: .96, rotation: -170, size: 9, shape: "square", color: "pink", delay: 100, duration: 1450 },
  { x: -.28, y: .91, rotation: 180, size: 8, shape: "circle", color: "orange", delay: 50, duration: 1490 },
  { x: -.62, y: .68, rotation: -150, size: 10, shape: "rectangle", color: "red", delay: 120, duration: 1450 },
  { x: -.88, y: .34, rotation: 200, size: 9, shape: "square", color: "yellow", delay: 20, duration: 1520 },
  { x: -.97, y: -.07, rotation: -140, size: 8, shape: "circle", color: "pink", delay: 70, duration: 1450 },
  { x: -.83, y: -.48, rotation: 170, size: 10, shape: "rectangle", color: "orange", delay: 40, duration: 1500 },
  { x: -.51, y: -.79, rotation: -180, size: 9, shape: "square", color: "blue", delay: 80, duration: 1440 },
  { x: -.19, y: -.91, rotation: 210, size: 7, shape: "circle", color: "red", delay: 110, duration: 1490 },
  { x: .67, y: .66, rotation: -220, size: 7, shape: "square", color: "red", delay: 0, duration: 1560 },
];
