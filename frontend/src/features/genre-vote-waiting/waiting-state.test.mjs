import test from "node:test";
import assert from "node:assert/strict";
import { summarizeParticipants } from "./waiting-state.ts";

const participants = [
  { id: "yu", nickname: "YU", tone: "peach", state: "complete" },
  { id: "mi", nickname: "MI", tone: "pink", state: "complete" },
  { id: "ke", nickname: "KE", tone: "blue", state: "waiting" },
];

test("1/3・2/3・3/3は入力された完了人数から残り人数と割合を算出する", () => {
  for (const completed of [1, 2, 3]) {
    const input = participants.map((participant, index) => ({ ...participant, state: index < completed ? "complete" : "waiting" }));
    assert.deepEqual(summarizeParticipants(input), {
      total: 3, completed, remaining: 3 - completed, percentage: completed / 3 * 100, allComplete: completed === 3,
    });
  }
});

test("空配列と全員待機は全員完了にせず、割合を0にする", () => {
  assert.deepEqual(summarizeParticipants([]), { total: 0, completed: 0, remaining: 0, percentage: 0, allComplete: false });
  const waiting = participants.map((participant) => ({ ...participant, state: "waiting" }));
  assert.deepEqual(summarizeParticipants(waiting), { total: 3, completed: 0, remaining: 3, percentage: 0, allComplete: false });
});

test("順序や名前ではなく状態を参照し、増減・取り消しで古い集計を残さない", () => {
  const before = structuredClone(participants);
  assert.equal(summarizeParticipants(participants).completed, 2);
  const changed = participants.map((participant) => ({ ...participant, nickname: "同じ長い名前", state: "waiting" }));
  assert.equal(summarizeParticipants(changed).completed, 0);
  assert.equal(summarizeParticipants([participants[0]]).allComplete, true);
  assert.equal(summarizeParticipants([...participants].reverse()).percentage, 2 / 3 * 100);
  assert.deepEqual(participants, before);
});

test("多数の参加者でも表示用の固定人数を用いず、正確に計算する", () => {
  const many = Array.from({ length: 25 }, (_, index) => ({ ...participants[index % participants.length], id: `participant-${index}` }));
  const completed = many.filter((participant) => participant.state === "complete").length;
  assert.equal(summarizeParticipants(many).total, many.length);
  assert.equal(summarizeParticipants(many).remaining, many.length - completed);
  assert.equal(summarizeParticipants(many).percentage, completed / many.length * 100);
});
