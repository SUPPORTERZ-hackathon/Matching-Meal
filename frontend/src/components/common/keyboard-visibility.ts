export type KeyboardVisibility = {
  enabled: boolean;
  coarsePointer: boolean;
  editableFocused: boolean;
  wasHidden: boolean;
  baselineHeight: number;
  visibleHeight: number;
  scale: number;
};

const MIN_KEYBOARD_SHRINK = 120;
const KEYBOARD_SHRINK_RATIO = 0.18;
export const MAX_UNZOOMED_SCALE = 1.05;

export function shouldHideBottomActionForKeyboard(metrics: KeyboardVisibility): boolean {
  if (!metrics.enabled || !metrics.coarsePointer || (!metrics.editableFocused && !metrics.wasHidden) || metrics.scale > MAX_UNZOOMED_SCALE
    || metrics.baselineHeight <= 0 || metrics.visibleHeight <= 0) return false;
  const shrink = metrics.baselineHeight - metrics.visibleHeight;
  return shrink >= Math.max(MIN_KEYBOARD_SHRINK, metrics.baselineHeight * KEYBOARD_SHRINK_RATIO);
}
