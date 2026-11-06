import "../genre-voting-api/test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { guestResultDestination } = await import("./guest-result-destination.ts");
const roomId = "123e4567-e89b-42d3-a456-426614174000";

test("参加者は候補保存が終わるまでジャンル結果で待ち、準備完了後だけ店舗画面へ進む", () => {
  for (const status of ["lobby", "genre_voting", "restaurant_searching", "expired"])
    assert.equal(guestResultDestination("member", { id: roomId, status }), undefined);
  assert.equal(guestResultDestination("member", { id: roomId, status: "restaurant_voting" }), `/restaurant-vote?room=${roomId}`);
  assert.equal(guestResultDestination("member", { id: roomId, status: "decided" }), `/restaurant-result?room=${roomId}`);
});

test("ホスト用の店舗検索操作とは分離し、不正なルームには遷移しない", () => {
  assert.equal(guestResultDestination("host", { id: roomId, status: "restaurant_voting" }), undefined);
  assert.equal(guestResultDestination("member", { id: "invalid", status: "restaurant_voting" }), undefined);
});
