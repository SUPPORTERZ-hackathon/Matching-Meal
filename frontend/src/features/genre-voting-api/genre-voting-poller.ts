import { ROOM_CONFIG, type RoomError, type RoomResult, type RoomSession } from "../room/room-data";
import { normalizeVotingRoomId, type GenreVotingSnapshot } from "./genre-voting-data";

export type GenreVotingView = { kind: "loading" } | { kind: "error"; error: RoomError }
  | { kind: "ready"; session: RoomSession; snapshot: GenreVotingSnapshot; staleError?: RoomError };

export const MAX_CONSECUTIVE_INVALID_RESPONSES = 3;

type GenreVotingPollerOptions = {
  roomId: string | undefined;
  polling: boolean;
  loadSession: (roomId: string) => RoomSession | undefined;
  getState: (session: RoomSession, signal: AbortSignal) => Promise<RoomResult<GenreVotingSnapshot>>;
  isHidden: () => boolean;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (timer: number) => void;
  onView: (view: GenreVotingView) => void;
};

export function createGenreVotingPoller(options: GenreVotingPollerOptions) {
  let view: GenreVotingView = { kind: "loading" };
  let disposed = false, inFlight = false, terminal = false, refreshQueued = false;
  let invalidResponses = 0;
  let timer: number | undefined, active: AbortController | undefined;
  const publish = (next: GenreVotingView) => { view = next; options.onView(next); };
  const clearTimer = () => { if (timer !== undefined) options.cancel(timer); timer = undefined; };

  async function refresh(force = false): Promise<void> {
    if (disposed || (!force && (options.isHidden() || terminal))) return;
    if (inFlight) { if (force) refreshQueued = true; return; }
    clearTimer();
    const validId = normalizeVotingRoomId(options.roomId);
    const session = validId ? options.loadSession(validId) : undefined;
    if (!session) {
      terminal = true;
      publish({ kind: "error", error: { code: "SESSION_MISSING", status: 0, message: "このタブにルームの参加情報がありません。作成・参加したタブを開いてください。" } });
      return;
    }
    inFlight = true;
    active = new AbortController();
    try {
      const result = await options.getState(session, active.signal);
      if (disposed || options.isHidden() || (!result.ok && result.error.code === "CANCELLED")) return;
      if (result.ok) {
        invalidResponses = 0;
        const previous = view.kind === "ready" ? view.snapshot : undefined;
        if (previous && (previous.room.version > result.data.room.version || (previous.result && !result.data.result))) return;
        terminal = result.data.result !== null;
        if (!previous || view.kind !== "ready" || view.staleError || previous.room.version !== result.data.room.version
          || previous.result !== null || result.data.result !== null) publish({ kind: "ready", session, snapshot: result.data });
      } else {
        if (result.error.code === "INVALID_RESPONSE") invalidResponses += 1;
        else invalidResponses = 0;
        terminal = [400, 401, 403, 404].includes(result.error.status)
          || invalidResponses >= MAX_CONSECUTIVE_INVALID_RESPONSES;
        publish(view.kind === "ready" && !terminal ? { ...view, staleError: result.error } : { kind: "error", error: result.error });
      }
    } finally {
      inFlight = false;
      active = undefined;
      if (!disposed && refreshQueued && !options.isHidden()) { refreshQueued = false; void refresh(true); }
      else if (options.polling && !disposed && !terminal && !options.isHidden())
        timer = options.schedule(() => { void refresh(); }, ROOM_CONFIG.pollInterval);
    }
  }

  function resume() {
    clearTimer();
    if (options.isHidden()) active?.abort();
    else if (!terminal) void refresh(true);
  }

  function retry() {
    terminal = false;
    invalidResponses = 0;
    void refresh(true);
  }

  function dispose() {
    disposed = true;
    clearTimer();
    active?.abort();
  }

  return { refresh, resume, retry, dispose };
}
