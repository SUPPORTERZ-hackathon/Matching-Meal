"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRoomState } from "./room-api";
import { ROOM_CONFIG, isRoomId, type RoomError, type RoomSession, type RoomSnapshot } from "./room-data";
import { loadRoomSession } from "./room-session";

export type RoomView = { kind: "loading" } | { kind: "error"; error: RoomError }
  | { kind: "ready"; session: RoomSession; snapshot: RoomSnapshot; origin: string; staleError?: RoomError };

export function useRoomState(roomId?: string, polling = true) {
  const [view, setView] = useState<RoomView>({ kind: "loading" });
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    let disposed = false, inFlight = false, terminal = false;
    let timer: number | undefined;
    let active: AbortController | undefined;
    function clearTimer() { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; }
    async function refresh(force = false) {
      if (disposed || inFlight || (!force && document.hidden)) return;
      clearTimer();
      const session = roomId && isRoomId(roomId) ? loadRoomSession(roomId) : undefined;
      if (!session) {
        terminal = true;
        setView({ kind: "error", error: { code: "SESSION_MISSING", status: 0, message: "このブラウザーにルームの参加情報がありません。作成したタブを開くか、招待リンクから参加してください。" } });
        return;
      }
      inFlight = true;
      active = new AbortController();
      try {
        const result = await getRoomState(session, active.signal);
        if (disposed || (!force && document.hidden) || (!result.ok && result.error.code === "CANCELLED")) return;
        if (result.ok) {
          terminal = false;
          setView((previous) => {
            if (previous.kind === "ready" && previous.snapshot.room.version > result.data.room.version) return previous;
            if (previous.kind === "ready" && !previous.staleError && previous.snapshot.room.version === result.data.room.version) return previous;
            return { kind: "ready", session, snapshot: result.data, origin: window.location.origin };
          });
        } else {
          terminal = [400, 401, 403, 404].includes(result.error.status) || result.error.code === "INVALID_RESPONSE";
          setView((previous) => previous.kind === "ready" && !terminal
            ? { ...previous, staleError: result.error } : { kind: "error", error: result.error });
        }
      } finally {
        inFlight = false;
        if (polling && !disposed && !terminal && !document.hidden) timer = window.setTimeout(refresh, ROOM_CONFIG.pollInterval);
      }
    }
    refreshRef.current = () => refresh(true);
    function visibilityChanged() {
      clearTimer();
      if (document.hidden) active?.abort();
      else void refresh(true);
    }
    queueMicrotask(() => { void refresh(true); });
    if (polling) {
      document.addEventListener("visibilitychange", visibilityChanged);
      window.addEventListener("online", visibilityChanged);
      window.addEventListener("focus", visibilityChanged);
    }
    return () => {
      disposed = true; clearTimer(); active?.abort(); refreshRef.current = null;
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("online", visibilityChanged);
      window.removeEventListener("focus", visibilityChanged);
    };
  }, [roomId, polling]);
  const retry = useCallback(() => { void refreshRef.current?.(); }, []);
  return { view, retry };
}
