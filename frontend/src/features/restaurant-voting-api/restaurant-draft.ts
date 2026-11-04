import type { JsonValue, RoomSession } from "../room/room-data";
import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";
import type { RestaurantVote } from "../restaurant-vote/vote-state";
import { validRestaurantVotePrefix } from "./restaurant-voting-data";

export type RestaurantDraft = { votes: readonly RestaurantVote[]; sealed: boolean; candidateIds: readonly string[] };
const memory = new Map<string, RestaurantDraft>();
const draftKey = (session: RoomSession): string => `meshimatch.restaurant-draft.v1:${session.room.id}:${session.participant.id}`;
export function parseRestaurantDraft(value: JsonValue, restaurants: readonly RestaurantCandidate[]): RestaurantDraft | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.sealed !== "boolean"
    || !Array.isArray(value.votes) || !Array.isArray(value.candidateIds)
    || value.candidateIds.some((id) => typeof id !== "string")) return;
  const candidateIds = value.candidateIds as string[];
  if (candidateIds.length !== restaurants.length || candidateIds.some((id, index) => id !== restaurants[index]?.id)) return;
  const votes: RestaurantVote[] = [];
  for (const row of value.votes) {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.restaurantId !== "string" || (row.choice !== "like" && row.choice !== "skip")) return;
    votes.push({ restaurantId: row.restaurantId, choice: row.choice });
  }
  return validRestaurantVotePrefix(votes, restaurants, value.sealed)
    ? { votes, sealed: value.sealed || votes.length === restaurants.length, candidateIds } : undefined;
}
export function loadRestaurantDraft(session: RoomSession, restaurants: readonly RestaurantCandidate[]): RestaurantDraft {
  const key = draftKey(session), cached = memory.get(key);
  if (cached && cached.candidateIds.every((id, index) => id === restaurants[index]?.id)) return cached;
  try {
    const raw: JsonValue = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    return parseRestaurantDraft(raw, restaurants) ?? { votes: [], sealed: false, candidateIds: restaurants.map((row) => row.id) };
  } catch { return { votes: [], sealed: false, candidateIds: restaurants.map((row) => row.id) }; }
}
export function saveRestaurantDraft(session: RoomSession, draft: RestaurantDraft): boolean {
  const key = draftKey(session); memory.set(key, draft);
  try { window.sessionStorage.setItem(key, JSON.stringify(draft)); return true; } catch { return false; }
}
export function clearRestaurantDraft(session: RoomSession): void {
  const key = draftKey(session); memory.delete(key);
  try { window.sessionStorage.removeItem(key); } catch { /* 提出済み状態を優先する。 */ }
}
