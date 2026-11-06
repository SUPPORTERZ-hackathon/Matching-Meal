import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRoomRequestKeyStore } from "./room-request-key.ts";

const body = { nickname: "合成テスト", searchLocation: { latitude: 1, longitude: 2 }, searchRange: 3 };
function fixture() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const dependencies = { storage: () => storage, uuid: randomUUID, digest: async input => createHash("sha256").update(input).digest("hex") };
  return { values, storage, dependencies, store: createRoomRequestKeyStore(dependencies) };
}

test("同一入力・再読み込み相当で同じキーを使い、異なる操作と成功後は新しいキー", async () => {
  const { store, dependencies } = fixture();
  const a = await store.acquire("/rooms", body), b = await store.acquire("/rooms", structuredClone(body));
  assert.match(a.key, /^[a-f0-9-]{36}$/); assert.deepEqual(a, b);
  assert.deepEqual(await createRoomRequestKeyStore(dependencies).acquire("/rooms", body), a);
  assert.notEqual((await store.acquire("/rooms", { ...body, searchRange: 4 })).key, a.key);
  assert.notEqual((await store.acquire("/join", body)).key, a.key);
  store.complete(a);
  assert.notEqual((await store.acquire("/rooms", body)).key, a.key);
});

test("ストレージへ本文・座標・招待先を保存しない", async () => {
  const { store, values } = fixture();
  await store.acquire("/rooms/TEST-INVITE/participants", body);
  const saved = JSON.stringify([...values]);
  for (const secret of ["合成テスト", "latitude", "longitude", "TEST-INVITE", "searchRange"]) assert(!saved.includes(secret));
});

test("生成・保存不能と破損キーを拒否し、削除失敗後も成功キーを再利用しない", async () => {
  const f = fixture();
  assert.equal(await createRoomRequestKeyStore({ ...f.dependencies, uuid: () => "invalid" }).acquire("/rooms", body), undefined);
  assert.equal(await createRoomRequestKeyStore({ ...f.dependencies, storage: () => { throw new Error("blocked"); } }).acquire("/rooms", body), undefined);
  const key = await f.store.acquire("/rooms", body);
  f.values.set(key.storageKey, "invalid");
  assert.equal(await createRoomRequestKeyStore(f.dependencies).acquire("/rooms", body), undefined);
  f.storage.removeItem = () => { throw new Error("blocked"); };
  f.store.complete(key);
  assert.notEqual((await f.store.acquire("/rooms", body)).key, key.key);
});
