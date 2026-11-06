import "../genre-voting-api/test-runtime.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { candidateResponse, restaurants, roomId, votingResponse } from "./test-fixtures.mjs";

const data = await import("./restaurant-voting-data.ts");
const draft = await import("./restaurant-draft.ts");

test("候補と店舗投票応答を検証して表示データへ変換する", () => {
  const candidates = data.parseRestaurantCandidatesResponse(candidateResponse);
  assert.equal(candidates?.restaurants.length, 2);
  assert.equal(candidates?.restaurants[0].coordinates.latitude, 35.5);
  assert.equal(candidates?.restaurants[0].address, "東京都渋谷区東1-2-3");
  assert.equal(candidates?.restaurants[1].address, undefined);
  assert.equal(candidates?.restaurants[1].photoUrl, undefined);
  const waiting = data.parseRestaurantVotingResponse(votingResponse({ submitted: true }));
  assert.equal(data.restaurantVotingStage(waiting), "waiting");
  const decided = data.parseRestaurantVotingResponse(votingResponse({ submitted: true, complete: true }));
  assert.equal(data.restaurantVotingStage(decided), "result");
  assert.deepEqual(data.restaurantResultPresentation(decided, candidates), { genreId: "ramen", restaurantId: "J001", votes: { likes: 2, total: 2 } });
  assert.equal(data.restaurantVotingUrl("result", roomId), `/restaurant-result?room=${roomId}`);
});

test("不正な候補・投票応答を拒否する", () => {
  for (const change of [
    (value) => { value.data.restaurants = []; },
    (value) => { value.data.restaurants.push(value.data.restaurants[0]); },
    (value) => { value.data.restaurants[0].source = "mock"; },
    (value) => { value.data.restaurants[0].coordinates.latitude = 91; },
    (value) => { value.data.restaurants[0].address = 123; },
    (value) => { value.data.restaurants[0].detailUrl = "https://evil.example/strJ001/"; },
  ]) {
    const value = structuredClone(candidateResponse); change(value);
    assert.equal(data.parseRestaurantCandidatesResponse(value), undefined);
  }
  for (const change of [
    (value) => { value.data.totalParticipantCount = 3; },
    (value) => { value.data.result.likeCount = 3; },
    (value) => { value.data.result.restaurant.id = ""; },
    (value) => { value.data.result.decisionMethod = "unknown"; },
    (value) => { value.data.room.status = "restaurant_voting"; },
  ]) {
    const value = structuredClone(votingResponse({ submitted: true, complete: true })); change(value);
    assert.equal(data.parseRestaurantVotingResponse(value), undefined);
  }
});

test("候補順の回答prefixと候補集合付き下書きを検証する", () => {
  const parsed = data.parseRestaurantCandidatesResponse(candidateResponse);
  const candidates = parsed.restaurants;
  const votes = [{ restaurantId: "J001", choice: "like" }, { restaurantId: "J002", choice: "skip" }];
  assert.equal(data.validRestaurantVotePrefix(votes, candidates, true), true);
  assert.equal(data.validRestaurantVotePrefix([...votes].reverse(), candidates, true), false);
  assert.deepEqual(draft.parseRestaurantDraft({ votes, sealed: true, candidateIds: ["J001", "J002"] }, candidates), { votes, sealed: true, candidateIds: ["J001", "J002"] });
  assert.equal(draft.parseRestaurantDraft({ votes, sealed: true, candidateIds: ["J002", "J001"] }, candidates), undefined);
  assert.equal(draft.parseRestaurantDraft({ votes: votes.slice(0, 1), sealed: true, candidateIds: ["J001", "J002"] }, candidates), undefined);
  assert.equal(restaurants.length, candidates.length);
});
