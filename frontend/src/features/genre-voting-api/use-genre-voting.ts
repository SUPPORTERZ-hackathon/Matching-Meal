"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadRoomSession } from "../room/room-session";
import { getGenreVoting } from "./genre-voting-api";
import { createGenreVotingPoller, type GenreVotingView } from "./genre-voting-poller";

export function useGenreVoting(roomId: string | undefined, polling: boolean) {
  const [view, setView] = useState<GenreVotingView>({ kind: "loading" });
  const refreshRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const poller = createGenreVotingPoller({
      roomId, polling, loadSession: loadRoomSession, getState: getGenreVoting,
      isHidden: () => document.hidden,
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: timer => window.clearTimeout(timer), onView: setView,
    });
    refreshRef.current = poller.retry;
    queueMicrotask(() => { void poller.refresh(true); });
    document.addEventListener("visibilitychange", poller.resume);
    window.addEventListener("online", poller.resume);
    window.addEventListener("focus", poller.resume);
    return () => {
      poller.dispose();
      refreshRef.current = null;
      document.removeEventListener("visibilitychange", poller.resume);
      window.removeEventListener("online", poller.resume);
      window.removeEventListener("focus", poller.resume);
    };
  }, [roomId, polling]);
  return { view, retry: useCallback(() => { refreshRef.current?.(); }, []) };
}
