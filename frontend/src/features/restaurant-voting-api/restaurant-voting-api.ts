import { request } from "../room/room-api";
import { ROOM_CONFIG, type RoomResult, type RoomSession } from "../room/room-data";
import type { RestaurantVote } from "../restaurant-vote/vote-state";
import { parseRestaurantCandidatesResponse, parseRestaurantVotingResponse, validRestaurantVotePrefix,
  type RestaurantCandidatesSnapshot, type RestaurantVotingSnapshot } from "./restaurant-voting-data";

const invalidResponse = () => ({ code: "INVALID_RESPONSE", status: 0, message: "店舗情報を確認できませんでした。もう一度お試しください。" } as const);
function validSessionResult<T extends { room: { id: string } }>(session: RoomSession, result: RoomResult<T>): RoomResult<T> {
  return result.ok && result.data.room.id !== session.room.id ? { ok: false, error: invalidResponse() } : result;
}
export async function getRestaurantCandidates(session: RoomSession, signal?: AbortSignal): Promise<RoomResult<RestaurantCandidatesSnapshot>> {
  return validSessionResult(session, await request(`${ROOM_CONFIG.apiBase}/${encodeURIComponent(session.room.id)}/restaurant-candidates`,
    "GET", parseRestaurantCandidatesResponse, session.sessionToken, undefined, signal));
}
export async function searchRestaurantCandidates(session: RoomSession, signal?: AbortSignal): Promise<RoomResult<RestaurantCandidatesSnapshot>> {
  return validSessionResult(session, await request(`${ROOM_CONFIG.apiBase}/${encodeURIComponent(session.room.id)}/restaurant-candidates/search`,
    "POST", parseRestaurantCandidatesResponse, session.sessionToken, undefined, signal));
}
export async function getRestaurantVoting(session: RoomSession, signal?: AbortSignal): Promise<RoomResult<RestaurantVotingSnapshot>> {
  const result = await request(`${ROOM_CONFIG.apiBase}/${encodeURIComponent(session.room.id)}/restaurant-voting`,
    "GET", parseRestaurantVotingResponse, session.sessionToken, undefined, signal);
  return result.ok && (result.data.room.id !== session.room.id || result.data.room.joinCode !== session.room.joinCode
    || result.data.currentParticipantId !== session.participant.id) ? { ok: false, error: invalidResponse() } : result;
}
async function putRestaurantVotes(session: RoomSession, votes: readonly RestaurantVote[], signal?: AbortSignal): Promise<RoomResult<RestaurantVotingSnapshot>> {
  const result = await request(`${ROOM_CONFIG.apiBase}/${encodeURIComponent(session.room.id)}/restaurant-votes`,
    "PUT", parseRestaurantVotingResponse, session.sessionToken, { votes: votes.map((vote) => ({ restaurantId: vote.restaurantId, choice: vote.choice })) }, signal);
  return result.ok && (result.data.room.id !== session.room.id || result.data.currentParticipantId !== session.participant.id || !result.data.submitted)
    ? { ok: false, error: invalidResponse() } : result;
}
export async function submitRestaurantAnswers(
  session: RoomSession,
  restaurants: RestaurantCandidatesSnapshot["restaurants"],
  votes: readonly RestaurantVote[],
  signal?: AbortSignal,
): Promise<RoomResult<RestaurantVotingSnapshot>> {
  if (!validRestaurantVotePrefix(votes, restaurants, true)) return { ok: false, error: { code: "INVALID_RESTAURANT_VOTES", status: 400, message: "すべての店舗への回答を確認してください。" } };
  const current = await getRestaurantVoting(session, signal);
  if (!current.ok || current.data.submitted) return current;
  if (current.data.room.status !== "restaurant_voting") return { ok: false, error: { code: "RESTAURANT_VOTING_NOT_ACTIVE", status: 409, message: "現在は店舗投票を提出できません。ルームの状態を確認してください。" } };
  const saved = await putRestaurantVotes(session, votes, signal);
  if (saved.ok || signal?.aborted || [400, 401, 403, 404].includes(saved.error.status)) return saved;
  const confirmed = await getRestaurantVoting(session, signal);
  return confirmed.ok && confirmed.data.submitted ? confirmed : saved;
}
