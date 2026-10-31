import { ROOM_CONFIG, isRoomId, normalizeJoinCode, parseErrorResponse, parseSessionResponse, parseSnapshotResponse, type JsonValue, type RoomError, type RoomResult, type RoomSession, type RoomSessionData, type RoomSnapshot } from "./room-data";

const invalidResponse = (): RoomError => ({ code: "INVALID_RESPONSE", message: "ルーム情報を確認できませんでした。もう一度お試しください。", status: 0 });

async function request<T>(path: string, method: "GET" | "POST", parse: (value: JsonValue) => T | undefined, token?: string, body?: { nickname: string }, signal?: AbortSignal): Promise<RoomResult<T>> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let timedOut = false;
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ROOM_CONFIG.requestTimeout);
  try {
    const response = await fetch(path, {
      method, cache: "no-store", redirect: "error", signal: controller.signal,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

export async function createRoom(nickname: string): Promise<RoomResult<RoomSessionData>> {
  const result = await request(ROOM_CONFIG.apiBase, "POST", parseSessionResponse, undefined, { nickname: nickname.trim() });
  return result.ok && result.data.participant.role !== "host" ? { ok: false, error: invalidResponse() } : result;
}
export async function joinRoom(code: string, nickname: string): Promise<RoomResult<RoomSessionData>> {
  const normalized = normalizeJoinCode(code);
  if (!normalized) return { ok: false, error: { code: "INVALID_REQUEST", message: "招待コードが正しくありません。", status: 400 } };
  const result = await request(`${ROOM_CONFIG.apiBase}/${encodeURIComponent(normalized)}/participants`, "POST", parseSessionResponse, undefined, { nickname: nickname.trim() });
  return result.ok && (result.data.room.joinCode !== normalized || result.data.participant.role !== "member") ? { ok: false, error: invalidResponse() } : result;
}
async function stateRequest(session: RoomSession, start: boolean, signal?: AbortSignal): Promise<RoomResult<RoomSnapshot>> {
  if (!isRoomId(session.room.id)) return { ok: false, error: invalidResponse() };
  const result = await request(`${ROOM_CONFIG.apiBase}/${encodeURIComponent(session.room.id)}${start ? "/genre-voting/start" : ""}`, start ? "POST" : "GET", parseSnapshotResponse, session.sessionToken, undefined, signal);
  return result.ok && (result.data.room.id !== session.room.id || result.data.room.joinCode !== session.room.joinCode || result.data.currentParticipantId !== session.participant.id)
    ? { ok: false, error: invalidResponse() } : result;
}
export const getRoomState = (session: RoomSession, signal?: AbortSignal): Promise<RoomResult<RoomSnapshot>> => stateRequest(session, false, signal);
export const startRoomVoting = (session: RoomSession): Promise<RoomResult<RoomSnapshot>> => stateRequest(session, true);
