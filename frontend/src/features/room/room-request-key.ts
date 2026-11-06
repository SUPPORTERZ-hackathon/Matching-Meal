import type { JsonValue } from "./room-data";

type KeyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type RoomRequestKey = { storageKey: string; key: string };
type KeyDependencies = { storage: () => KeyStorage; digest: (input: string) => Promise<string>; uuid: () => string };
const STORAGE_PREFIX = "meshimatch.room-request.v1.";
const VALID_KEY = /^[A-Za-z0-9_-]{16,128}$/;

// 本文そのものを保存せず、同じ送信内容の再試行だけに操作キーを再利用する。
export function createRoomRequestKeyStore(dependencies: KeyDependencies) {
  const memory = new Map<string, string | null>();
  return {
    async acquire(path: string, body: JsonValue): Promise<RoomRequestKey | undefined> {
      try {
        const storageKey = STORAGE_PREFIX + await dependencies.digest(JSON.stringify([path, body]));
        const previous = memory.has(storageKey) ? memory.get(storageKey) : dependencies.storage().getItem(storageKey);
        if (previous && !VALID_KEY.test(previous)) return;
        const key = previous || dependencies.uuid();
        if (!VALID_KEY.test(key)) return;
        if (!previous) dependencies.storage().setItem(storageKey, key);
        memory.set(storageKey, key);
        return { storageKey, key };
      } catch { return; }
    },
    complete(operation: RoomRequestKey) {
      // 成功直後にストレージ削除が失敗しても、このタブで古い操作を再利用しない。
      memory.set(operation.storageKey, null);
      try { dependencies.storage().removeItem(operation.storageKey); } catch { /* 成功した操作を再送しない。 */ }
    },
  };
}

export const roomRequestKeys = createRoomRequestKeyStore({
  storage: () => sessionStorage,
  uuid: () => crypto.randomUUID(),
  digest: async input => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  },
});
