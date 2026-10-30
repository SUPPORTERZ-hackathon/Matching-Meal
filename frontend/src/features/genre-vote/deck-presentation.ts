export const DECK_PRESENTATION = {
  shadeOpacity: .45, restingScale: .96, restingOffset: 8,
  brightenStartWidthRatio: .25, shadeCurveExponent: 2, exitClearance: 1,
} as const;

export type CardExitGeometry = {
  cardWidth: number; cardHeight: number; centerX: number;
  clipLeft: number; clipRight: number; rotationDegrees: number;
};

export function cardExitDistance(geometry: CardExitGeometry, direction: 1 | -1): number {
  const { cardWidth, cardHeight, centerX, clipLeft, clipRight, rotationDegrees } = geometry;
  if (![cardWidth, cardHeight, centerX, clipLeft, clipRight, rotationDegrees].every(Number.isFinite)
    || cardWidth <= 0 || cardHeight < 0 || clipRight < clipLeft) return 0;
  const radians = rotationDegrees * Math.PI / 180;
  const halfWidth = (cardWidth * Math.abs(Math.cos(radians)) + cardHeight * Math.abs(Math.sin(radians))) / 2;
  const toEdge = direction === 1 ? clipRight - centerX : centerX - clipLeft;
  return Math.max(0, toEdge + halfWidth + DECK_PRESENTATION.exitClearance);
}

export function nextCardShadeOpacity(distance: number, cardWidth: number, exitDistance: number): number {
  const start = cardWidth * DECK_PRESENTATION.brightenStartWidthRatio;
  if (![distance, cardWidth, exitDistance].every(Number.isFinite) || cardWidth <= 0 || exitDistance <= start) {
    return DECK_PRESENTATION.shadeOpacity;
  }
  const progress = Math.max(0, Math.min((Math.abs(distance) - start) / (exitDistance - start), 1));
  return DECK_PRESENTATION.shadeOpacity * (1 - progress ** DECK_PRESENTATION.shadeCurveExponent);
}

export function nextCardPresentation(progress: number) {
  const amount = Number.isFinite(progress) ? Math.max(0, Math.min(progress, 1)) : 0;
  return {
    scale: DECK_PRESENTATION.restingScale + (1 - DECK_PRESENTATION.restingScale) * amount,
    offset: DECK_PRESENTATION.restingOffset * (1 - amount),
  };
}
