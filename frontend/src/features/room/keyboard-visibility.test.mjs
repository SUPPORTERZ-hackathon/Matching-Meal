import test from "node:test";
import assert from "node:assert/strict";

const { shouldHideBottomActionForKeyboard } = await import("../../components/common/keyboard-visibility.ts");
const base = { enabled: true, coarsePointer: true, editableFocused: true, wasHidden: false, baselineHeight: 800, visibleHeight: 800, scale: 1 };

test("文字入力と大きな表示領域縮小が重なった場合だけ固定操作を隠す", () => {
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, visibleHeight: 600 }), true);
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, visibleHeight: 680 }), false);
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, visibleHeight: 700 }), false);
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, visibleHeight: 600, editableFocused: false }), false);
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, visibleHeight: 600, editableFocused: false, wasHidden: true }), true);
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, visibleHeight: 800, editableFocused: false, wasHidden: true }), false);
});

test("PC入力、非対象画面、ピンチズームでは隠さない", () => {
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, enabled: false, visibleHeight: 500 }), false);
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, coarsePointer: false, visibleHeight: 500 }), false);
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, scale: 1.5, visibleHeight: 500 }), false);
  assert.equal(shouldHideBottomActionForKeyboard({ ...base, baselineHeight: 0, visibleHeight: 500 }), false);
});
