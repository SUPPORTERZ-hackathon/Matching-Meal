"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROOM_CONFIG, type RoomError, type RoomSession } from "../room/room-data";
import { loadRoomSession } from "../room/room-session";
import { getGenreVoting } from "./genre-voting-api";
import { normalizeVotingRoomId, type GenreVotingSnapshot } from "./genre-voting-data";

export type GenreVotingView = { kind: "loading" } | { kind: "error"; error: RoomError }
  | { kind: "ready"; session: RoomSession; snapshot: GenreVotingSnapshot; staleError?: RoomError };

export function useGenreVoting(roomId: string | undefined, polling: boolean) {
  const [view, setView] = useState<GenreVotingView>({ kind: "loading" });
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    let disposed = false, inFlight = false, terminal = false, refreshQueued = false;
    let timer: number | undefined, active: AbortController | undefined;
    const clearTimer = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
    async function refresh(force = false) {
      if (disposed || (!force && (document.hidden || terminal))) return;
      if (inFlight) { if (force) refreshQueued = true; return; }
      clearTimer();
      const validId = normalizeVotingRoomId(roomId), session = validId ? loadRoomSession(validId) : undefined;
      if (!session) { terminal = true; setView({ kind: "error", error: { code: "SESSION_MISSING", status: 0, message: "このタブにルームの参加情報がありません。作成・参加したタブを開いてください。" } }); return; }
      inFlight = true; active = new AbortController();
      try {
        const result = await getGenreVoting(session, active.signal);
        if (disposed || document.hidden || (!result.ok && result.error.code === "CANCELLED")) return;
        if (result.ok) {
          terminal = result.data.result !== null;
          setView(previous => previous.kind === "ready" && previous.snapshot.room.version > result.data.room.version ? previous
            : previous.kind === "ready" && !previous.staleError && previous.snapshot.room.version === result.data.room.version ? previous
              : { kind: "ready", session, snapshot: result.data });
        } else {
          terminal = [400, 401, 403, 404].includes(result.error.status) || result.error.code === "INVALID_RESPONSE";
          setView(previous => previous.kind === "ready" && !terminal ? { ...previous, staleError: result.error } : { kind: "error", error: result.error });
        }
      } finally {
        inFlight = false;
        if (!disposed && refreshQueued && !document.hidden) { refreshQueued = false; void refresh(true); }
        else if (polling && !disposed && !terminal && !document.hidden) timer = window.setTimeout(() => { void refresh(); }, ROOM_CONFIG.pollInterval);
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
