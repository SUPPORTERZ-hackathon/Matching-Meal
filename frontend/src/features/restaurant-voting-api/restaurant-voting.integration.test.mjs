import "../genre-voting-api/test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { GENRES } = await import("../genre-vote/genres.ts");
const { submitGenreAnswers } = await import("../genre-voting-api/genre-voting-api.ts");
const { getRestaurantCandidates, searchRestaurantCandidates, getRestaurantVoting, submitRestaurantAnswers } = await import("./restaurant-voting-api.ts");
const { createGoogleMapsUrl } = await import("../restaurant-result/maps-url.ts");
const base = process.env.RESTAURANT_VOTING_API_BASE;
const enabled = base === "http://localhost:3000";

async function makeRoom(http) {
  const create = await http(`${base}/api/v1/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    nickname: "店舗結合確認ホスト", searchLocation: { latitude: 35.658, longitude: 139.7016 }, searchRange: 3,
  }) });
  assert.equal(create.status, 201); const host = (await create.json()).data;
  const join = await http(`${base}/api/v1/rooms/${host.room.joinCode}/participants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: "店舗結合確認ゲスト" }) });
  assert.equal(join.status, 201); const guest = (await join.json()).data;
  const start = await http(`${base}/api/v1/rooms/${host.room.id}/genre-voting/start`, { method: "POST", headers: { Authorization: `Bearer ${host.sessionToken}` } });
  assert.equal(start.status, 200); await start.json();
  const votes = GENRES.map((genre) => ({ genreId: genre.id, choice: genre.id === "ramen" ? "like" : "skip" }));
  assert((await submitGenreAnswers(host, votes)).ok); assert((await submitGenreAnswers(guest, votes)).ok);
  return { host, guest };
}
function relativeFetch(t) {
  const original = globalThis.fetch.bind(globalThis);
  t.mock.method(globalThis, "fetch", (path, options) => original(new URL(path, base), options));
  return original;
}

test("実API: 候補検索・2人の店舗投票・待機・決定結果・同一再送", { skip: !enabled, timeout: 30000 }, async (t) => {
  const { host, guest } = await makeRoom(relativeFetch(t));
  const searched = await searchRestaurantCandidates(host); assert(searched.ok); assert(searched.data.restaurants.length >= 1 && searched.data.restaurants.length <= 5);
  assert.equal(searched.data.genreId, "ramen");
  const memberCandidates = await getRestaurantCandidates(guest); assert(memberCandidates.ok);
  assert.deepEqual(memberCandidates.data.restaurants.map((row) => row.id), searched.data.restaurants.map((row) => row.id));
  const votes = searched.data.restaurants.map((restaurant, index) => ({ restaurantId: restaurant.id, choice: index === 0 ? "like" : "skip" }));
  const first = await submitRestaurantAnswers(host, searched.data.restaurants, votes); assert(first.ok); assert.equal(first.data.submittedParticipantCount, 1); assert.equal(first.data.result, null);
  const waiting = await getRestaurantVoting(guest); assert(waiting.ok); assert.equal(waiting.data.submitted, false); assert.equal(waiting.data.participants.filter((row) => row.submitted).length, 1);
  const last = await submitRestaurantAnswers(guest, memberCandidates.data.restaurants, votes); assert(last.ok); assert.equal(last.data.room.status, "decided");
  const [hostResult, guestResult] = await Promise.all([getRestaurantVoting(host), getRestaurantVoting(guest)]); assert(hostResult.ok && guestResult.ok);
  assert.deepEqual(hostResult.data.result, guestResult.data.result); assert.equal(hostResult.data.result.restaurant.id, searched.data.restaurants[0].id);
  assert.equal(hostResult.data.result.likeCount, 2); assert.equal(hostResult.data.result.decisionMethod, "most_likes");
  const decidedCandidates = await getRestaurantCandidates(host);
  assert(decidedCandidates.ok);
  assert.equal(decidedCandidates.data.room.status, "decided");
  assert(createGoogleMapsUrl(hostResult.data.result.restaurant.coordinates));
  const repeated = await submitRestaurantAnswers(host, searched.data.restaurants, votes); assert(repeated.ok);
  assert.equal(repeated.data.room.version, hostResult.data.room.version); assert.deepEqual(repeated.data.result, hostResult.data.result);
});
