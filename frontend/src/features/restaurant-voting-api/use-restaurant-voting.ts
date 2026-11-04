"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROOM_CONFIG, isRoomId, type RoomError, type RoomSession } from "../room/room-data";
import { loadRoomSession } from "../room/room-session";
import { getRestaurantCandidates, getRestaurantVoting, searchRestaurantCandidates } from "./restaurant-voting-api";
import type { RestaurantCandidatesSnapshot, RestaurantVotingSnapshot } from "./restaurant-voting-data";

export type RestaurantVotingView = { kind: "loading" } | { kind: "error"; error: RoomError }
  | { kind: "ready"; session: RoomSession; candidates: RestaurantCandidatesSnapshot; voting: RestaurantVotingSnapshot; staleError?: RoomError };

export function useRestaurantVoting(roomId: string | undefined, polling: boolean) {
  const [view, setView] = useState<RestaurantVotingView>({ kind: "loading" });
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    let disposed = false, inFlight = false, terminal = false, refreshQueued = false;
    let timer: number | undefined, active: AbortController | undefined;
    const clearTimer = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
    async function refresh(force = false) {
      if (disposed || (!force && (document.hidden || terminal))) return;
      if (inFlight) { if (force) refreshQueued = true; return; }
      clearTimer();
      const validId = roomId && isRoomId(roomId) ? roomId.toLowerCase() : undefined;
      const session = validId ? loadRoomSession(validId) : undefined;
      if (!session) { terminal = true; setView({ kind: "error", error: { code: "SESSION_MISSING", status: 0, message: "このタブにルームの参加情報がありません。作成・参加したタブを開いてください。" } }); return; }
      inFlight = true; active = new AbortController();
      let pendingCandidates = false;
      try {
        let candidateResult = await getRestaurantCandidates(session, active.signal);
        if (!candidateResult.ok && candidateResult.error.code === "RESTAURANT_CANDIDATES_NOT_READY") {
          if (session.participant.role === "host") candidateResult = await searchRestaurantCandidates(session, active.signal);
          else pendingCandidates = true;
        }
        if (disposed || document.hidden || (!candidateResult.ok && candidateResult.error.code === "CANCELLED")) return;
        if (!candidateResult.ok) {
          if (pendingCandidates) setView((previous) => previous.kind === "ready" ? previous : { kind: "loading" });
          else { terminal = [400, 401, 403, 404].includes(candidateResult.error.status) || candidateResult.error.code === "INVALID_RESPONSE"; setView({ kind: "error", error: candidateResult.error }); }
          return;
        }
        const votingResult = await getRestaurantVoting(session, active.signal);
        if (disposed || document.hidden || (!votingResult.ok && votingResult.error.code === "CANCELLED")) return;
        if (!votingResult.ok) {
          terminal = [400, 401, 403, 404].includes(votingResult.error.status) || votingResult.error.code === "INVALID_RESPONSE";
          setView((previous) => previous.kind === "ready" && !terminal ? { ...previous, staleError: votingResult.error } : { kind: "error", error: votingResult.error });
          return;
        }
        if (votingResult.data.result && !candidateResult.data.restaurants.some((row) => row.id === votingResult.data.result?.restaurant.id)) {
          terminal = true; setView({ kind: "error", error: { code: "INVALID_RESPONSE", status: 0, message: "決定した店舗を候補一覧で確認できませんでした。" } }); return;
        }
        terminal = votingResult.data.result !== null;
        setView((previous) => previous.kind === "ready" && previous.voting.room.version > votingResult.data.room.version ? previous
          : previous.kind === "ready" && !previous.staleError && previous.voting.room.version === votingResult.data.room.version ? previous
            : { kind: "ready", session, candidates: candidateResult.data, voting: votingResult.data });
      } finally {
        inFlight = false;
        if (!disposed && refreshQueued && !document.hidden) { refreshQueued = false; void refresh(true); }
        else if ((pendingCandidates || polling) && !disposed && !terminal && !document.hidden) timer = window.setTimeout(() => { void refresh(); }, ROOM_CONFIG.pollInterval);
      }
    }
    refreshRef.current = () => refresh(true);
    function resume() { clearTimer(); if (document.hidden) active?.abort(); else if (!terminal) void refresh(true); }
    queueMicrotask(() => { void refresh(true); });
    document.addEventListener("visibilitychange", resume); window.addEventListener("online", resume); window.addEventListener("focus", resume);
    return () => { disposed = true; clearTimer(); active?.abort(); refreshRef.current = null;
      document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); window.removeEventListener("focus", resume); };
  }, [roomId, polling]);
  return { view, retry: useCallback(() => { void refreshRef.current?.(); }, []) };
}
