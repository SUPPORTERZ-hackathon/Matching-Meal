import { ROOM_CONFIG, isRoomId, normalizeJoinCode, parseErrorResponse, parseSessionResponse, parseSnapshotResponse, validNickname, type JsonValue, type RoomError, type RoomResult, type RoomSession, type RoomSessionData, type RoomSnapshot } from "./room-data";
import type { CurrentCoordinates } from "./current-location";
import { roomRequestKeys } from "./room-request-key";

const invalidResponse = (): RoomError => ({ code: "INVALID_RESPONSE", message: "ルーム情報を確認できませんでした。もう一度お試しください。", status: 0 });

export async function request<T>(path: string, method: "GET" | "POST" | "PUT", parse: (value: JsonValue) => T | undefined, token?: string, body?: JsonValue, signal?: AbortSignal, idempotencyKey?: string): Promise<RoomResult<T>> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let timedOut = false;
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ROOM_CONFIG.requestTimeout);
  try {
    const response = await fetch(path, {
      method, cache: "no-store", redirect: "error", signal: controller.signal,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw: JsonValue | undefined = await response.json().catch(() => undefined);
    if (raw === undefined) return { ok: false, error: invalidResponse() };
    if (!response.ok) return { ok: false, error: parseErrorResponse(raw, response.status) };
    const data = parse(raw);
    return data ? { ok: true, data } : { ok: false, error: invalidResponse() };
  } catch {
    return { ok: false, error: { code: signal?.aborted ? "CANCELLED" : timedOut ? "TIMEOUT" : "NETWORK_ERROR", message: timedOut ? "通信がタイムアウトしました。接続を確認して再度お試しください。" : "通信できませんでした。接続を確認してください。", status: 0 } };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export type RoomSearchRange = 1 | 2 | 3 | 4 | 5;
export type CreateRoomInput = {
  nickname: string;
  searchLocation: CurrentCoordinates;
  searchRange: RoomSearchRange;
};

function validCreateRoomInput(input: CreateRoomInput): boolean {
  return validNickname(input.nickname)
    && Number.isFinite(input.searchLocation.latitude)
    && input.searchLocation.latitude >= -90
    && input.searchLocation.latitude <= 90
    && Number.isFinite(input.searchLocation.longitude)
    && input.searchLocation.longitude >= -180
    && input.searchLocation.longitude <= 180
    && Number.isInteger(input.searchRange)
    && input.searchRange >= 1
    && input.searchRange <= 5;
}

const activeRoomMutations = new Map<string, Promise<RoomResult<RoomSessionData>>>();
function roomMutation(path: string, body: JsonValue, valid: (data: RoomSessionData) => boolean): Promise<RoomResult<RoomSessionData>> {
  const identity = JSON.stringify([path, body]);
  const active = activeRoomMutations.get(identity);
  if (active) return active;
  const pending = (async (): Promise<RoomResult<RoomSessionData>> => {
    const operation = await roomRequestKeys.acquire(path, body);
    if (!operation) return requestKeyUnavailable();
    const result = await request(path, "POST", parseSessionResponse, undefined, body, undefined, operation.key);
    if (result.ok && !valid(result.data)) return { ok: false, error: invalidResponse() };
    if (result.ok) roomRequestKeys.complete(operation);
    return result;
  })();
  activeRoomMutations.set(identity, pending);
  const release = () => { if (activeRoomMutations.get(identity) === pending) activeRoomMutations.delete(identity); };
  void pending.then(release, release);
  return pending;
}

export async function createRoom(input: CreateRoomInput): Promise<RoomResult<RoomSessionData>> {
  if (!validCreateRoomInput(input)) {
    return { ok: false, error: { code: "INVALID_REQUEST", message: "入力内容を確認してください。", status: 400 } };
  }
  const body = {
    nickname: input.nickname.trim(),
    searchLocation: { latitude: input.searchLocation.latitude, longitude: input.searchLocation.longitude },
    searchRange: input.searchRange,
  };
  return roomMutation(ROOM_CONFIG.apiBase, body, data => data.participant.role === "host");
}
export async function joinRoom(code: string, nickname: string): Promise<RoomResult<RoomSessionData>> {
  const normalized = normalizeJoinCode(code);
  if (!normalized) return { ok: false, error: { code: "INVALID_REQUEST", message: "招待コードが正しくありません。", status: 400 } };
  if (!validNickname(nickname)) return { ok: false, error: { code: "INVALID_REQUEST", message: "ニックネームを確認してください。", status: 400 } };
  const path = `${ROOM_CONFIG.apiBase}/${encodeURIComponent(normalized)}/participants`, body = { nickname: nickname.trim() };
  return roomMutation(path, body, data => data.room.joinCode === normalized && data.participant.role === "member");
}
const requestKeyUnavailable = (): RoomResult<RoomSessionData> => ({ ok: false, error: { code: "REQUEST_KEY_UNAVAILABLE", status: 0, message: "安全な再送に必要な操作情報を保存できません。HTTPSまたはlocalhostで開き、ブラウザーのストレージ設定を確認してください。送信は行っていません。" } });
async function stateRequest(session: RoomSession, start: boolean, signal?: AbortSignal): Promise<RoomResult<RoomSnapshot>> {
  if (!isRoomId(session.room.id)) return { ok: false, error: invalidResponse() };
  const result = await request(`${ROOM_CONFIG.apiBase}/${encodeURIComponent(session.room.id)}${start ? "/genre-voting/start" : ""}`, start ? "POST" : "GET", parseSnapshotResponse, session.sessionToken, undefined, signal);
  return result.ok && (result.data.room.id !== session.room.id || result.data.room.joinCode !== session.room.joinCode || result.data.currentParticipantId !== session.participant.id)
    ? { ok: false, error: invalidResponse() } : result;
}
export const getRoomState = (session: RoomSession, signal?: AbortSignal): Promise<RoomResult<RoomSnapshot>> => stateRequest(session, false, signal);
export const startRoomVoting = (session: RoomSession): Promise<RoomResult<RoomSnapshot>> => stateRequest(session, true);
