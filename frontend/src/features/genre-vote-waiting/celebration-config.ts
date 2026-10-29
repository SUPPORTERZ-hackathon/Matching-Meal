export const CELEBRATION = {
  duration: 2600,
  cleanupGrace: 100,
  haloDelay: 2700,
  haloCycle: 2800,
  haloMinScale: .80,
  haloMaxScale: 1.05,
} as const;

export const CONFETTI_COLORS = {
  red: "var(--primary)",
  yellow: "#f6b63d",
  blue: "#8ecfdf",
  pink: "#ee9baf",
  orange: "#f2a15e",
} as const;

type ConfettiPiece = {
  readonly shape: "circle" | "square" | "rectangle";
  readonly size: number;
  readonly color: keyof typeof CONFETTI_COLORS;
  readonly startX: number;
  readonly startY: number;
  readonly x: number;
  readonly rise: number;
  readonly fall: number;
  readonly sway: number;
  readonly rotation: number;
  readonly delay: number;
  readonly duration: number;
};

// Figmaの丸/四角を参考にした一度きりの装飾。全片がduration内に消える軌道にする。
// 乱数や毎フレームのJSを使わず、SSRとクライアントで同じ図形を描く。
export const CONFETTI_PIECES: readonly ConfettiPiece[] = [
  { shape: "circle", size: 10, color: "red", startX: -8, startY: 2, x: -70, rise: -40, fall: 56, sway: 9, rotation: -120, delay: 90, duration: 2250 },
  { shape: "square", size: 9, color: "yellow", startX: -5, startY: -3, x: -49, rise: -52, fall: 62, sway: -10, rotation: 210, delay: 140, duration: 2380 },
  { shape: "circle", size: 8, color: "blue", startX: -2, startY: -4, x: -26, rise: -57, fall: 64, sway: 12, rotation: -150, delay: 110, duration: 2300 },
  { shape: "circle", size: 9, color: "pink", startX: 1, startY: -4, x: -3, rise: -55, fall: 60, sway: -11, rotation: 160, delay: 180, duration: 2360 },
  { shape: "square", size: 9, color: "orange", startX: 4, startY: -2, x: 22, rise: -50, fall: 62, sway: 10, rotation: 225, delay: 120, duration: 2400 },
  { shape: "rectangle", size: 8, color: "red", startX: 7, startY: 0, x: 46, rise: -41, fall: 58, sway: -9, rotation: -205, delay: 170, duration: 2220 },
  { shape: "square", size: 8, color: "yellow", startX: 9, startY: 3, x: 68, rise: -29, fall: 54, sway: 8, rotation: 140, delay: 130, duration: 2140 },
  { shape: "square", size: 9, color: "blue", startX: -7, startY: 4, x: -63, rise: -23, fall: 62, sway: -8, rotation: 190, delay: 240, duration: 2160 },
  { shape: "circle", size: 7, color: "pink", startX: -4, startY: 1, x: -41, rise: -35, fall: 60, sway: 11, rotation: -170, delay: 280, duration: 2140 },
  { shape: "square", size: 10, color: "orange", startX: -2, startY: -1, x: -18, rise: -47, fall: 64, sway: -12, rotation: 230, delay: 210, duration: 2300 },
  { shape: "circle", size: 8, color: "red", startX: 2, startY: -3, x: 8, rise: -50, fall: 62, sway: 9, rotation: -140, delay: 250, duration: 2250 },
  { shape: "rectangle", size: 8, color: "yellow", startX: 5, startY: 0, x: 33, rise: -37, fall: 64, sway: -11, rotation: 200, delay: 260, duration: 2240 },
  { shape: "circle", size: 7, color: "blue", startX: 8, startY: 3, x: 57, rise: -27, fall: 58, sway: 8, rotation: -165, delay: 220, duration: 2100 },
  { shape: "square", size: 8, color: "pink", startX: -5, startY: 5, x: -31, rise: -17, fall: 64, sway: -10, rotation: 175, delay: 300, duration: 2180 },
  { shape: "rectangle", size: 8, color: "orange", startX: 6, startY: 5, x: 39, rise: -15, fall: 60, sway: 10, rotation: -190, delay: 320, duration: 2110 },
  { shape: "square", size: 7, color: "red", startX: -1, startY: -5, x: -6, rise: -58, fall: 64, sway: 12, rotation: 245, delay: 160, duration: 2440 },
];
