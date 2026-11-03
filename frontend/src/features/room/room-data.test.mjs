import test from "node:test";
import assert from "node:assert/strict";
import { inviteUrl, isLocalOrigin, isRoomId, normalizeJoinCode, parseErrorResponse, parseSessionResponse, parseSnapshotResponse, parseStoredSessions, roomWaitingUrl, validNickname } from "./room-data.ts";

const room = { id: "550e8400-e29b-41d4-a716-446655440000", joinCode: "7K9M2QXR", status: "lobby", version: 1, expiresAt: "2026-11-01T12:00:00Z" };
const host = { id: "8d5b0ad5-e8c6-47f2-8e87-f6180b175759", nickname: "ホスト", role: "host" };
const member = { id: "3a3cf4d0-c2ef-4f40-bcb8-61f0ce680916", nickname: "ホスト", role: "member" };
const session = { room, participant: host, sessionToken: "test-opaque-token" };
const snapshot = { room, currentParticipantId: host.id, participants: [host, member] };

test("APIの8文字コードを正規化し、紛らわしい文字・不正UUIDを拒否する", () => {
  assert.equal(normalizeJoinCode(" 7k9m2qxr "), room.joinCode);
  for (const code of ["2481", "7K9M2QXI", "7K9M2QX0", "7K9M2QX/", "7K9M2QXR?x=1"]) assert.equal(normalizeJoinCode(code), undefined);
  assert(isRoomId(room.id)); assert(!isRoomId(room.id + "/../")); assert(!isRoomId("not-a-room"));
});
test("招待URLは接続元オリジンとコードだけを含み、外部転送やトークンを作らない", () => {
  assert.equal(inviteUrl("https://meal-test.trycloudflare.com", room.joinCode), "https://meal-test.trycloudflare.com/j/7K9M2QXR");
  assert.equal(inviteUrl("http://localhost:3000", "7k9m2qxr"), "http://localhost:3000/j/7K9M2QXR");
  for (const origin of ["javascript:alert(1)", "https://user:pass@example.com", "https://example.com/other", "https://example.com?token=secret", "invalid"]) assert.equal(inviteUrl(origin, room.joinCode), undefined);
  assert.equal(inviteUrl("https://example.com", "invalid"), undefined);
  assert(!inviteUrl("https://example.com", room.joinCode).includes(session.sessionToken));
  assert(isLocalOrigin("http://localhost:3000")); assert(isLocalOrigin("http://127.0.0.1:3000")); assert(isLocalOrigin("http://[::1]:3000"));
  assert(!isLocalOrigin("https://meal-test.trycloudflare.com"));
  assert.equal(roomWaitingUrl(room.id), `/room-waiting?room=${room.id}`);
});
test("ニックネームはUI12文字/バックエンド20文字を区別し、制御文字を送らない", () => {
  assert(validNickname(" ゆうき ")); assert(!validNickname(" ")); assert(!validNickname("ゆう\tき"));
  assert(validNickname("あ".repeat(12))); assert(!validNickname("あ".repeat(13))); assert(validNickname("あ".repeat(20),20)); assert(!validNickname("あ".repeat(21),20));
  assert(validNickname("😀😀"));
});
test("作成/参加の必須値を検証し、不完全なレスポンスを成功としない", () => {
  assert.deepEqual(parseSessionResponse({ data: session }), session);
  for (const value of [null, {}, { data: { ...session, sessionToken: "" } }, { data: { ...session, sessionToken: "bad\ntoken" } }, { data: { ...session, room: { ...room, id: "invalid" } } }, { data: { ...session, room: { ...room, expiresAt: "invalid" } } }, { data: { ...session, participant: { ...host, role: "admin" } } }]) assert.equal(parseSessionResponse(value), undefined);
});
test("状態は参加者IDとAPI順序を使用し、同名の参加者を別人として表示する", () => {
  assert.deepEqual(parseSnapshotResponse({ data: snapshot }), snapshot);
  const reversed = { ...snapshot, participants: [member, host] };
  assert.deepEqual(parseSnapshotResponse({ data: reversed }).participants, reversed.participants);
});
test("重複参加者・複数ホスト・不明な現在参加者・空一覧を表示用データにしない", () => {
  for (const data of [{ ...snapshot, participants: [] }, { ...snapshot, participants: [host,host] }, { ...snapshot, participants: [host,{...member,role:"host"}] }, { ...snapshot,currentParticipantId:"missing" }, { ...snapshot,room:{...room,version:0} }, { ...snapshot,room:{...room,status:"unregistered"} }]) assert.equal(parseSnapshotResponse({ data }), undefined);
});
test("保存セッションを復元し、破損した値と関係のないフィールドを引き継がない", () => {
  const stored = { ...session, localSearch: { location: "検証用集合場所", radiusMeters: 1000 } };
  assert.deepEqual(parseStoredSessions([stored])[0], stored);
  assert.deepEqual(parseStoredSessions({ data: session }), []);
  assert.deepEqual(parseStoredSessions([null,{ broken:true }]), []);
  assert.equal(parseStoredSessions([{ ...session, localSearch: {location:4,radiusMeters:"wrong"} }])[0].localSearch, undefined);
});
test("APIエラーコード/メッセージを保持し、形式不正時は安全なメッセージへ戻す", () => {
  assert.deepEqual(parseErrorResponse({error:{code:"ROOM_NOT_FOUND",message:"ルームが見つかりません。",requestId:"test"}},404),{code:"ROOM_NOT_FOUND",message:"ルームが見つかりません。",status:404});
  assert.equal(parseErrorResponse(null,503).code,"INVALID_RESPONSE");
  assert.equal(parseErrorResponse({sessionToken:"never-display"},500).message.includes("never-display"),false);
});
