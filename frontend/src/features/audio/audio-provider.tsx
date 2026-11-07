"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AUDIO_FADE_MS, AUDIO_STORAGE_KEY, AUDIO_TRACKS, RESULT_SE_TRACKS, isPlaybackBlocked, maxFailuresFor, type AudioTrack, type BgmTrack, type PlayOutcome, type ResultSeTrack, type SeTrack } from "./audio-config";

type Settings = { bgm: boolean; se: boolean };
type AudioContextValue = {
  settings: Settings;
  ready: boolean;
  blockedTrack: AudioTrack | null;
  failedTrack: AudioTrack | null;
  setBgmEnabled: (enabled: boolean) => void;
  startHomeBgm: () => void;
  setSeEnabled: (enabled: boolean) => void;
  playSe: (track: SeTrack) => Promise<PlayOutcome>;
  playGenreResult: (resultKey: string) => void;
  playRestaurantDecision: (resultKey: string) => void;
};
type AudioEntry = { element: HTMLAudioElement; onError: () => void };
type BufferedPlayback = { source: AudioBufferSourceNode; gain: GainNode };
type ResultRequest = { track: ResultSeTrack; key: string; attempts: number; inFlight: boolean };
const SE_TRACKS: readonly SeTrack[] = ["genre-vote", "genre-undo", "genre-result", "restaurant-vote", "restaurant-decide"];

const INITIAL_SETTINGS: Settings = { bgm: false, se: true };
const AppAudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const [restored, setRestored] = useState(false);
  const [blockedTrack, setBlockedTrack] = useState<AudioTrack | null>(null);
  const [failedTrack, setFailedTrack] = useState<AudioTrack | null>(null);
  const settingsRef = useRef(settings);
  const pathnameRef = useRef(pathname);
  const previousPathname = useRef(pathname);
  const entries = useRef(new Map<AudioTrack, AudioEntry>());
  const failures = useRef(new Map<AudioTrack, number>());
  const activeBgm = useRef<BgmTrack | null>(null);
  const pendingBgm = useRef<BgmTrack | null>(null);
  const fadeFrame = useRef<number | null>(null);
  const decisionKey = useRef<string | null>(null);
  const playedGenreResults = useRef(new Set<string>());
  const playedDecisions = useRef(new Set<string>());
  const pendingResult = useRef<ResultRequest | null>(null);
  const retryResult = useRef<() => void>(() => {});
  const audioContext = useRef<AudioContext | null>(null);
  const decoded = useRef(new Map<ResultSeTrack, AudioBuffer>());
  const decoding = useRef(new Map<ResultSeTrack, Promise<AudioBuffer | null>>());
  const decodeControllers = useRef(new Map<ResultSeTrack, AbortController>());
  const bufferedPlayback = useRef<BufferedPlayback | null>(null);
  const playbackGeneration = useRef(0);

  const drop = useCallback((track: AudioTrack) => {
    const entry = entries.current.get(track);
    if (!entry) return;
    entry.element.removeEventListener("error", entry.onError);
    entry.element.pause();
    entries.current.delete(track);
    if (activeBgm.current === track) activeBgm.current = null;
  }, []);

  const markFailure = useCallback((track: AudioTrack, element: HTMLAudioElement) => {
    if (entries.current.get(track)?.element !== element) return;
    failures.current.set(track, (failures.current.get(track) ?? 0) + 1);
    setFailedTrack(track);
    drop(track);
  }, [drop]);

  const getAudio = useCallback((track: AudioTrack): HTMLAudioElement | null => {
    if ((failures.current.get(track) ?? 0) >= maxFailuresFor(track)) return null;
    const existing = entries.current.get(track);
    if (existing) return existing.element;
    const audio = new Audio(AUDIO_TRACKS[track].src);
    audio.preload = AUDIO_TRACKS[track].kind === "se" ? "auto" : "none";
    audio.volume = AUDIO_TRACKS[track].volume;
    audio.loop = AUDIO_TRACKS[track].kind === "bgm";
    const onError = () => markFailure(track, audio);
    audio.addEventListener("error", onError);
    entries.current.set(track, { element: audio, onError });
    return audio;
  }, [markFailure]);

  const stopBufferedSe = useCallback(() => {
    const current = bufferedPlayback.current;
    if (!current) return;
    bufferedPlayback.current = null;
    current.source.onended = null;
    try { current.source.stop(); } catch { /* 再生終了後の停止は不要。 */ }
    current.source.disconnect();
    current.gain.disconnect();
  }, []);

  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    if (previousPathname.current === pathname) return;
    ++playbackGeneration.current;
    pendingResult.current = null;
    stopBufferedSe();
    for (const track of SE_TRACKS) entries.current.get(track)?.element.pause();
    previousPathname.current = pathname;
  }, [pathname, stopBufferedSe]);

  const decodeResultSe = useCallback((track: ResultSeTrack): Promise<AudioBuffer | null> => {
    const cached = decoded.current.get(track);
    if (cached) return Promise.resolve(cached);
    const pending = decoding.current.get(track);
    if (pending) return pending;
    const context = audioContext.current;
    if (!context || (failures.current.get(track) ?? 0) >= maxFailuresFor(track)) return Promise.resolve(null);
    const controller = new AbortController();
    decodeControllers.current.set(track, controller);
    const loading = fetch(AUDIO_TRACKS[track].src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (audioContext.current === context && !controller.signal.aborted) decoded.current.set(track, buffer);
        return buffer;
      })
      .catch(() => {
        if (!controller.signal.aborted && audioContext.current === context) {
          failures.current.set(track, (failures.current.get(track) ?? 0) + 1);
          setFailedTrack(track);
        }
        return null;
      })
      .finally(() => {
        if (decodeControllers.current.get(track) === controller) decodeControllers.current.delete(track);
        decoding.current.delete(track);
      });
    decoding.current.set(track, loading);
    return loading;
  }, []);

  const handleContextStateChange = useCallback(() => {
    if (audioContext.current?.state === "running") retryResult.current();
  }, []);

  const primeResultSe = useCallback(() => {
    if (!settingsRef.current.se || typeof window.AudioContext !== "function") return;
    try {
      const context = audioContext.current ?? new window.AudioContext();
      if (!audioContext.current) context.addEventListener("statechange", handleContextStateChange);
      audioContext.current = context;
      if (context.state !== "running") void context.resume().catch(() => { /* ブラウザーの再生許可に従う。 */ });
      for (const track of RESULT_SE_TRACKS) void decodeResultSe(track);
    } catch { /* Web Audio非対応ならHTMLAudioElementへフォールバックする。 */ }
  }, [decodeResultSe, handleContextStateChange]);

  const playTrack = useCallback(async (track: AudioTrack): Promise<PlayOutcome> => {
    const audio = getAudio(track);
    if (!audio) return "failed";
    try {
      if (AUDIO_TRACKS[track].kind === "se") {
        audio.currentTime = 0;
        audio.volume = AUDIO_TRACKS[track].volume;
      }
      await audio.play();
      if (AUDIO_TRACKS[track].kind === "bgm" && activeBgm.current !== track) {
        audio.pause();
        return "interrupted";
      }
      setBlockedTrack((current) => current === track ? null : current);
      setFailedTrack((current) => current === track ? null : current);
      return "played";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "interrupted";
      if (error instanceof Error && isPlaybackBlocked(error)) {
        setBlockedTrack(track);
        return "blocked";
      }
      markFailure(track, audio);
      return "failed";
    }
  }, [getAudio, markFailure]);

  const playResultSe = useCallback(async (track: ResultSeTrack): Promise<PlayOutcome> => {
    const context = audioContext.current;
    if (document.hidden) return "interrupted";
    if (!context) return playTrack(track);
    if (context.state !== "running") {
      if (context.state !== "closed") void context.resume().catch(() => { /* 次の自然な操作を待つ。 */ });
      return "blocked";
    }
    const generation = playbackGeneration.current;
    const route = pathnameRef.current;
    const buffer = await decodeResultSe(track);
    if (generation !== playbackGeneration.current || pathnameRef.current !== route || !settingsRef.current.se || document.hidden) return "interrupted";
    if (!buffer) return playTrack(track);
    if (context.state !== "running") {
      if (context.state !== "closed") void context.resume().catch(() => { /* 中断時は再開を待つ。 */ });
      return "blocked";
    }
    try {
      stopBufferedSe();
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = AUDIO_TRACKS[track].volume;
      source.connect(gain);
      gain.connect(context.destination);
      bufferedPlayback.current = { source, gain };
      source.onended = () => {
        if (bufferedPlayback.current?.source === source) bufferedPlayback.current = null;
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      setBlockedTrack((current) => current === track ? null : current);
      setFailedTrack((current) => current === track ? null : current);
      return "played";
    } catch {
      stopBufferedSe();
      return playTrack(track);
    }
  }, [decodeResultSe, playTrack, stopBufferedSe]);

  const cancelFade = useCallback(() => {
    if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
    fadeFrame.current = null;
  }, []);

  const stopBgm = useCallback((fade = false) => {
    cancelFade();
    const key = activeBgm.current;
    if (!key) return;
    const audio = entries.current.get(key)?.element;
    if (!audio) { activeBgm.current = null; return; }
    if (!fade || window.matchMedia("(prefers-reduced-motion: reduce)").matches || audio.paused) {
      audio.pause(); audio.currentTime = 0; audio.volume = AUDIO_TRACKS[key].volume; activeBgm.current = null;
      return;
    }
    const initial = audio.volume;
    const start = performance.now();
    const frame = (now: number) => {
      const progress = Math.min(1, (now - start) / AUDIO_FADE_MS);
      audio.volume = initial * (1 - progress);
      if (progress < 1) fadeFrame.current = requestAnimationFrame(frame);
      else { audio.pause(); audio.currentTime = 0; audio.volume = AUDIO_TRACKS[key].volume; activeBgm.current = null; fadeFrame.current = null; }
    };
    fadeFrame.current = requestAnimationFrame(frame);
  }, [cancelFade]);

  const startBgm = useCallback((track: BgmTrack) => {
    if (!settingsRef.current.bgm || document.hidden) return;
    if (pendingBgm.current === track) return;
    if (activeBgm.current === track && !entries.current.get(track)?.element.paused) {
      cancelFade();
      const current = entries.current.get(track)?.element;
      if (current) current.volume = AUDIO_TRACKS[track].volume;
      return;
    }
    if (activeBgm.current && activeBgm.current !== track) stopBgm();
    const audio = getAudio(track);
    if (!audio) return;
    cancelFade();
    activeBgm.current = track;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    audio.volume = reduced ? AUDIO_TRACKS[track].volume : 0;
    pendingBgm.current = track;
    void playTrack(track).then((outcome) => {
      if (pendingBgm.current === track) pendingBgm.current = null;
      if (outcome !== "played" || activeBgm.current !== track) return;
      if (reduced) return;
      const start = performance.now();
      const frame = (now: number) => {
        if (activeBgm.current !== track || audio.paused) { fadeFrame.current = null; return; }
        const progress = Math.min(1, (now - start) / AUDIO_FADE_MS);
        audio.volume = AUDIO_TRACKS[track].volume * progress;
        fadeFrame.current = progress < 1 ? requestAnimationFrame(frame) : null;
      };
      fadeFrame.current = requestAnimationFrame(frame);
    });
  }, [cancelFade, getAudio, playTrack, stopBgm]);

  const playSe = useCallback((track: SeTrack): Promise<PlayOutcome> => {
    if (!settingsRef.current.se) return Promise.resolve("disabled");
    return track === "genre-result" || track === "restaurant-decide" ? playResultSe(track) : playTrack(track);
  }, [playResultSe, playTrack]);

  const attemptPendingResult = useCallback(() => {
    const request = pendingResult.current;
    if (!request || request.inFlight || request.attempts >= 3) return;
    const expectedPath = request.track === "genre-result" ? "/genre-result" : "/restaurant-result";
    if (pathnameRef.current !== expectedPath || document.hidden) return;
    request.inFlight = true;
    request.attempts += 1;
    void playSe(request.track).then((outcome) => {
      if (pendingResult.current !== request) return;
      request.inFlight = false;
      if (outcome === "played" || outcome === "disabled") {
        (request.track === "genre-result" ? playedGenreResults : playedDecisions).current.add(request.key);
        pendingResult.current = null;
      }
    });
  }, [playSe]);
  useEffect(() => { retryResult.current = attemptPendingResult; }, [attemptPendingResult]);

  const playGenreResult = useCallback((resultKey: string) => {
    if (playedGenreResults.current.has(resultKey)) return;
    if (pendingResult.current?.track !== "genre-result" || pendingResult.current.key !== resultKey) {
      pendingResult.current = { track: "genre-result", key: resultKey, attempts: 0, inFlight: false };
    }
    attemptPendingResult();
  }, [attemptPendingResult]);

  const beginDecision = useCallback(() => {
    if (!decisionKey.current || pathnameRef.current !== "/restaurant-result") return;
    stopBgm();
    attemptPendingResult();
  }, [attemptPendingResult, stopBgm]);

  const playRestaurantDecision = useCallback((resultKey: string) => {
    if (playedDecisions.current.has(resultKey)) {
      return;
    }
    decisionKey.current = resultKey;
    if (pendingResult.current?.track !== "restaurant-decide" || pendingResult.current.key !== resultKey) {
      pendingResult.current = { track: "restaurant-decide", key: resultKey, attempts: 0, inFlight: false };
    }
    beginDecision();
  }, [beginDecision]);

  const setBgmEnabled = useCallback((enabled: boolean) => {
    settingsRef.current = { ...settingsRef.current, bgm: enabled };
    setSettings(settingsRef.current);
    if (!enabled) { stopBgm(); setBlockedTrack((current) => AUDIO_TRACKS[current ?? "genre-vote"].kind === "bgm" ? null : current); }
    else if (pathnameRef.current === "/home-preview") startBgm("home-bgm");
  }, [startBgm, stopBgm]);

  const startHomeBgm = useCallback(() => {
    if (pathnameRef.current !== "/home-preview") return;
    failures.current.delete("home-bgm");
    setFailedTrack((current) => current === "home-bgm" ? null : current);
    if (!settingsRef.current.bgm) setBgmEnabled(true);
    else startBgm("home-bgm");
  }, [setBgmEnabled, startBgm]);

  const setSeEnabled = useCallback((enabled: boolean) => {
    settingsRef.current = { ...settingsRef.current, se: enabled };
    setSettings(settingsRef.current);
    if (!enabled) {
      ++playbackGeneration.current;
      stopBufferedSe();
      for (const track of SE_TRACKS) entries.current.get(track)?.element.pause();
      setBlockedTrack((current) => current && AUDIO_TRACKS[current].kind === "se" ? null : current);
    } else primeResultSe();
  }, [primeResultSe, stopBufferedSe]);

  useEffect(() => {
    let cancelled = false;
    let savedSettings: Settings | null = null;
    try {
      const saved = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (saved) {
        const parsed: Settings = JSON.parse(saved);
        if (typeof parsed.bgm === "boolean" && typeof parsed.se === "boolean") savedSettings = parsed;
      }
    } catch { /* ストレージが利用できなくても音声設定は使える。 */ }
    queueMicrotask(() => {
      if (cancelled) return;
      if (savedSettings) { settingsRef.current = savedSettings; setSettings(savedSettings); }
      setRestored(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings)); }
    catch { /* 永続化できなくても現在のタブでは設定を保つ。 */ }
  }, [restored, settings]);

  useEffect(() => {
    if (!restored) return;
    const onClick = () => { primeResultSe(); retryResult.current(); };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [restored, primeResultSe]);

  useEffect(() => {
    let cancelled = false;
    if (pathname === "/home-preview") {
      if (restored && settings.bgm) queueMicrotask(() => { if (!cancelled && pathnameRef.current === "/home-preview") startBgm("home-bgm"); });
    } else if (activeBgm.current === "home-bgm") stopBgm(true);
    if (pathname !== "/restaurant-result") {
      entries.current.get("restaurant-decide")?.element.pause();
      decisionKey.current = null;
    }
    return () => { cancelled = true; };
  }, [pathname, restored, settings.bgm, startBgm, stopBgm]);

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        stopBgm();
        ++playbackGeneration.current;
        stopBufferedSe();
        for (const track of SE_TRACKS) entries.current.get(track)?.element.pause();
      } else {
        if (pathnameRef.current === "/home-preview") startBgm("home-bgm");
        retryResult.current();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [startBgm, stopBgm, stopBufferedSe]);

  useEffect(() => () => {
    ++playbackGeneration.current;
    stopBufferedSe(); cancelFade();
    for (const controller of decodeControllers.current.values()) controller.abort();
    decodeControllers.current.clear();
    decoding.current.clear();
    decoded.current.clear();
    const context = audioContext.current;
    audioContext.current = null;
    if (context) context.removeEventListener("statechange", handleContextStateChange);
    if (context && context.state !== "closed") void context.close().catch(() => {});
    for (const track of entries.current.keys()) drop(track);
    playedGenreResults.current.clear();
    playedDecisions.current.clear();
    pendingResult.current = null;
    decisionKey.current = null;
  }, [cancelFade, drop, handleContextStateChange, stopBufferedSe]);

  const value = useMemo<AudioContextValue>(() => ({ settings, ready: restored, blockedTrack, failedTrack, setBgmEnabled, startHomeBgm, setSeEnabled, playSe, playGenreResult, playRestaurantDecision }), [settings, restored, blockedTrack, failedTrack, setBgmEnabled, startHomeBgm, setSeEnabled, playSe, playGenreResult, playRestaurantDecision]);
  return <AppAudioContext.Provider value={value}>{children}</AppAudioContext.Provider>;
}

export function useAudio() {
  const context = useContext(AppAudioContext);
  if (!context) throw new Error("AudioProviderが見つかりません");
  return context;
}
