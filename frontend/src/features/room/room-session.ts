"use client";

import { ROOM_CONFIG, parseStoredSessions, type JsonValue, type RoomSession } from "./room-data";

// ストレージ保存が成功直後に失敗した場合も、取得済みトークンをそのタブでは失わない。
const memory = new Map<string, RoomSession>();

export function roomStorageAvailable(): boolean {
  try {
    sessionStorage.setItem(ROOM_CONFIG.storageProbeKey, "1");
    sessionStorage.removeItem(ROOM_CONFIG.storageProbeKey);
    return true;
  } catch { return false; }
}
function persistedSessions(): RoomSession[] {
  try {
    const raw: JsonValue = JSON.parse(sessionStorage.getItem(ROOM_CONFIG.storageKey) ?? "[]");
    return parseStoredSessions(raw);
  } catch { return []; }
}
export function saveRoomSession(session: RoomSession): boolean {
  memory.set(session.room.id, session);
  try {
    const sessions = persistedSessions().filter((row) => row.room.id !== session.room.id);
    sessionStorage.setItem(ROOM_CONFIG.storageKey, JSON.stringify([...sessions, session]));
    return true;
  } catch {
    memory.set(session.room.id, { ...session, persistenceWarning: true });
    return false;
  }
}
export function loadRoomSession(roomId: string): RoomSession | undefined {
  return memory.get(roomId) ?? persistedSessions().find((row) => row.room.id === roomId);
}
export function findRoomSession(joinCode: string): RoomSession | undefined {
  return [...memory.values(), ...persistedSessions()].find((row) => row.room.joinCode === joinCode);
}
export function forgetRoomSession(roomId: string): void {
  memory.delete(roomId);
  try { sessionStorage.setItem(ROOM_CONFIG.storageKey, JSON.stringify(persistedSessions().filter((row) => row.room.id !== roomId))); } catch { /* 利用不可のストレージは変更せず、メモリのセッションだけを破棄する。 */ }
}
