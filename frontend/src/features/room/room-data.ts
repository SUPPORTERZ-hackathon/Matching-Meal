export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
export type RoomStatus = "lobby" | "genre_voting" | "restaurant_searching" | "restaurant_voting" | "decided" | "expired";
export type Room = { id: string; joinCode: string; status: RoomStatus; version: number; expiresAt: string };
export type RoomParticipant = { id: string; nickname: string; role: "host" | "member" };
export type RoomSessionData = { room: Room; participant: RoomParticipant; sessionToken: string };
export type LocalSearchSettings = { location: string; radiusMeters: number };
export type RoomSession = RoomSessionData & { localSearch?: LocalSearchSettings; persistenceWarning?: boolean };
export type RoomSnapshot = { room: Room; currentParticipantId: string; participants: RoomParticipant[] };
export type RoomError = { code: string; message: string; status: number };
export type RoomResult<T> = { ok: true; data: T } | { ok: false; error: RoomError };

export const ROOM_CONFIG = {
  apiBase: "/api/v1/rooms", pollInterval: 2000, requestTimeout: 10000,
  minimumParticipants: 2, maximumParticipants: 20, nicknameLimit: 12, apiNicknameLimit: 20,
  storageKey: "meshimatch.room-sessions.v1", storageProbeKey: "meshimatch.storage-probe",
} as const;
const ROOM_STATUSES: readonly string[] = ["lobby", "genre_voting", "restaurant_searching", "restaurant_voting", "decided", "expired"];
const JOIN_CODE = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;
const ROOM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRoomId(value: string): boolean { return ROOM_ID.test(value); }
export function normalizeJoinCode(value: string): string | undefined {
  const code = value.trim().toUpperCase();
  return JOIN_CODE.test(code) ? code : undefined;
}
export function validNickname(value: string, maximum: number = ROOM_CONFIG.nicknameLimit): boolean {
  const name = value.trim();
  return Array.from(name).length > 0 && Array.from(name).length <= maximum && !/\p{Cc}/u.test(name);
}
function object(value: JsonValue): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function parseRoom(value: JsonValue): Room | undefined {
  const data = object(value);
  if (!data || typeof data.id !== "string" || !isRoomId(data.id)
    || typeof data.joinCode !== "string" || normalizeJoinCode(data.joinCode) !== data.joinCode
    || typeof data.status !== "string" || !ROOM_STATUSES.includes(data.status)
    || typeof data.version !== "number" || !Number.isSafeInteger(data.version) || data.version < 1
    || typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt))) return;
  return { id: data.id, joinCode: data.joinCode, status: data.status as RoomStatus, version: data.version, expiresAt: data.expiresAt };
}
function parseParticipant(value: JsonValue): RoomParticipant | undefined {
  const data = object(value);
  if (!data || typeof data.id !== "string" || !isRoomId(data.id)
    || typeof data.nickname !== "string" || !validNickname(data.nickname, ROOM_CONFIG.apiNicknameLimit)
    || (data.role !== "host" && data.role !== "member")) return;
  return { id: data.id, nickname: data.nickname, role: data.role };
}
export function parseSessionData(value: JsonValue): RoomSessionData | undefined {
  const data = object(value);
  if (!data) return;
  const room = parseRoom(data.room ?? null), participant = parseParticipant(data.participant ?? null);
  if (!room || !participant || typeof data.sessionToken !== "string" || !data.sessionToken || /\s|\p{Cc}/u.test(data.sessionToken)) return;
  return { room, participant, sessionToken: data.sessionToken };
}
export function parseSessionResponse(value: JsonValue): RoomSessionData | undefined {
  return parseSessionData(object(value)?.data ?? null);
}
export function parseSnapshotResponse(value: JsonValue): RoomSnapshot | undefined {
  const data = object(object(value)?.data ?? null);
  if (!data || typeof data.currentParticipantId !== "string" || !Array.isArray(data.participants)) return;
  const room = parseRoom(data.room ?? null);
  const participants = data.participants.map(parseParticipant);
  if (!room || participants.length < 1 || participants.length > ROOM_CONFIG.maximumParticipants
    || participants.some((row) => !row)) return;
  const rows = participants.filter((row): row is RoomParticipant => row !== undefined);
  if (new Set(rows.map((row) => row.id)).size !== rows.length || rows.filter((row) => row.role === "host").length !== 1
    || !rows.some((row) => row.id === data.currentParticipantId)) return;
  return { room, currentParticipantId: data.currentParticipantId, participants: rows };
}
export function parseErrorResponse(value: JsonValue, status: number): RoomError {
  const error = object(object(value)?.error ?? null);
  return error && typeof error.code === "string" && typeof error.message === "string"
    ? { code: error.code, message: error.message, status }
    : { code: "INVALID_RESPONSE", message: "サーバーの応答を確認できませんでした。時間をおいて再度お試しください。", status };
}
export function parseStoredSessions(value: JsonValue): RoomSession[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const session = parseSessionData(item), raw = object(item);
    if (!session || !raw) return [];
    const search = object(raw.localSearch ?? null);
    const localSearch = search && typeof search.location === "string" && typeof search.radiusMeters === "number" && Number.isFinite(search.radiusMeters)
      ? { location: search.location, radiusMeters: search.radiusMeters } : undefined;
    return [{ ...session, localSearch }];
  });
}
export function roomWaitingUrl(roomId: string): string { return `/room-waiting?room=${encodeURIComponent(roomId)}`; }
export function roomGenreUrl(roomId: string): string { return `/genre-vote?room=${encodeURIComponent(roomId)}`; }
export function inviteUrl(origin: string, rawCode: string): string | undefined {
  const code = normalizeJoinCode(rawCode);
  if (!code) return;
  try {
    const base = new URL(origin);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) return;
    return new URL(`/j/${encodeURIComponent(code)}`, base.origin).href;
  } catch { return; }
}
export function isLocalOrigin(origin: string): boolean {
  try { return /^(localhost|127\.[\d.]+|\[::1\]|0\.0\.0\.0)$/.test(new URL(origin).hostname) || new URL(origin).hostname.endsWith('.localhost'); }
  catch { return true; }
}
