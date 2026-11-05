import type { RoomError, RoomResult, RoomSession } from "../room/room-data";
import type { RestaurantCandidatesSnapshot } from "./restaurant-voting-data";

export type CandidateReadReason = "initial" | "read" | "retry";
type CandidateRequest = (session: RoomSession, signal?: AbortSignal) => Promise<RoomResult<RestaurantCandidatesSnapshot>>;

// effectの再実行・ポーリングでも共有する。読み取りから検索POSTを暗黙に再送しない。
export function createRestaurantCandidateLoader(get: CandidateRequest, search: CandidateRequest) {
  let attempted = false, searching = false;
  let searchError: RoomError | undefined;
  return {
    async load(session: RoomSession, reason: CandidateReadReason, signal?: AbortSignal): Promise<RoomResult<RestaurantCandidatesSnapshot>> {
      const candidates = await get(session, signal);
      if (signal?.aborted || candidates.ok || candidates.error.status !== 409 || candidates.error.code !== "RESTAURANT_CANDIDATES_NOT_READY" || session.participant.role !== "host") return candidates;
      if (!attempted && reason === "read") return { ok: false, error: {
        code: "RESTAURANT_SEARCH_NOT_STARTED", status: 409, message: "店舗検索はまだ開始されていません。候補を再確認して再試行してください。",
      } };
      const maySearch = !searching && (reason === "retry" || (reason === "initial" && !attempted));
      if (!maySearch) return searchError ? { ok: false, error: searchError } : candidates;
      attempted = true; searching = true; searchError = undefined;
      try {
        const result = await search(session, signal);
        if (!result.ok) searchError = result.error.code === "CANCELLED"
          ? { code: "RESTAURANT_SEARCH_UNCONFIRMED", status: 0, message: "検索の完了を確認できませんでした。候補を再確認してから、必要に応じて再試行してください。" }
          : result.error;
        return result;
      } finally { searching = false; }
    },
  };
}
