import type { JsonValue, RoomSession } from "../room/room-data";
import type { GenreVote } from "../genre-vote/vote-state";
import { validVotePrefix } from "./genre-voting-data";
import { GENRES } from "../genre-vote/genres";

export type GenreDraft = { votes: readonly GenreVote[]; sealed: boolean };
const memory = new Map<string, GenreDraft>();
export const draftKey = (session: RoomSession): string => `meshimatch.genre-draft.v1:${session.room.id}:${session.participant.id}`;
export function parseGenreDraft(value: JsonValue): GenreDraft | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.sealed !== "boolean" || !Array.isArray(value.votes)) return;
  const votes: GenreVote[] = [];
  for (const row of value.votes) {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.genreId !== "string" || (row.choice !== "like" && row.choice !== "skip")) return;
    votes.push({ genreId: row.genreId, choice: row.choice });
  }
  return validVotePrefix(votes, value.sealed) ? { votes, sealed: value.sealed || votes.length === GENRES.length } : undefined;
}
export function loadGenreDraft(session: RoomSession): GenreDraft {
  const cached = memory.get(draftKey(session));
  if (cached) return cached;
  try { const raw: JsonValue = JSON.parse(window.sessionStorage.getItem(draftKey(session)) ?? "null"); return parseGenreDraft(raw) ?? { votes: [], sealed: false }; }
  catch { return { votes: [], sealed: false }; }
}
export function saveGenreDraft(session: RoomSession, draft: GenreDraft): boolean {
  memory.set(draftKey(session), draft);
  try { window.sessionStorage.setItem(draftKey(session), JSON.stringify(draft)); return true; } catch { return false; }
}
export function clearGenreDraft(session: RoomSession): void {
  memory.delete(draftKey(session));
  try { window.sessionStorage.removeItem(draftKey(session)); } catch { /* サーバーの提出状態を優先し、保存不可でも編集画面へ戻さない。 */ }
}
