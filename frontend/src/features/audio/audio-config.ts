export const AUDIO_STORAGE_KEY = "meal-audio-settings-v1";
export const AUDIO_FADE_MS = 240;
export const AUDIO_MAX_FAILURES = 2;

export const AUDIO_TRACKS = {
  "genre-vote": { src: "/audio/genre-vote.mp3", volume: 0.45, kind: "se" },
  "genre-undo": { src: "/audio/genre-undo.mp3", volume: 0.45, kind: "se" },
  "genre-result": { src: "/audio/genre-result.mp3", volume: 0.5, kind: "se" },
  "restaurant-vote": { src: "/audio/restaurant-vote.mp3", volume: 0.45, kind: "se" },
  "restaurant-decide": { src: "/audio/restaurant-decide.m4a", volume: 0.6, kind: "se" },
  "home-bgm": { src: "/audio/home-bgm.mp3", volume: 0.2, kind: "bgm" },
} as const;

export type AudioTrack = keyof typeof AUDIO_TRACKS;
export type SeTrack = "genre-vote" | "genre-undo" | "genre-result" | "restaurant-vote" | "restaurant-decide";
export type ResultSeTrack = "genre-result" | "restaurant-decide";
export type BgmTrack = "home-bgm";
export type PlayOutcome = "played" | "blocked" | "failed" | "disabled" | "interrupted";
export const RESULT_SE_TRACKS: readonly ResultSeTrack[] = ["genre-result", "restaurant-decide"];

export function isPlaybackBlocked(error: Error): boolean {
  return error.name === "NotAllowedError";
}

export function maxFailuresFor(track: AudioTrack): number {
  return track === "restaurant-vote" ? 1 : AUDIO_MAX_FAILURES;
}
