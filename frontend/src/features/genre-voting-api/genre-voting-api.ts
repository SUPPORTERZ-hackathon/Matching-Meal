import { request } from "../room/room-api";
import { ROOM_CONFIG, type RoomResult, type RoomSession } from "../room/room-data";
import type { GenreVote } from "../genre-vote/vote-state";
import { parseGenreVotingResponse, validVotePrefix, type GenreVotingSnapshot } from "./genre-voting-data";

async function call(session: RoomSession, votes?: readonly GenreVote[], signal?: AbortSignal): Promise<RoomResult<GenreVotingSnapshot>> {
  const result = await request(`${ROOM_CONFIG.apiBase}/${encodeURIComponent(session.room.id)}/${votes ? "genre-votes" : "genre-voting"}`,
    votes ? "PUT" : "GET", parseGenreVotingResponse, session.sessionToken,
    votes ? { votes: votes.map(vote => ({ genreId: vote.genreId, choice: vote.choice })) } : undefined, signal);
  return result.ok && (result.data.room.id !== session.room.id || result.data.room.joinCode !== session.room.joinCode
    || result.data.currentParticipantId !== session.participant.id || (votes && !result.data.submitted))
    ? { ok: false, error: { code: "INVALID_RESPONSE", status: 0, message: "投票情報を確認できませんでした。回答を保持しています。" } } : result;
}
export const getGenreVoting = (session: RoomSession, signal?: AbortSignal): Promise<RoomResult<GenreVotingSnapshot>> => call(session, undefined, signal);

// 応答消失時にも変更提出せず、R6で確認してから同じ16回答だけを送る。
export async function submitGenreAnswers(session: RoomSession, votes: readonly GenreVote[], signal?: AbortSignal): Promise<RoomResult<GenreVotingSnapshot>> {
  if (!validVotePrefix(votes, true)) return { ok: false, error: { code: "INVALID_GENRE_VOTES", status: 400, message: "16ジャンルの回答を確認してください。" } };
  const current = await getGenreVoting(session, signal);
  if (!current.ok || current.data.submitted) return current;
  if (current.data.room.status !== "genre_voting") return { ok: false, error: { code: "GENRE_VOTING_NOT_ACTIVE", status: 409, message: "現在はジャンル投票を提出できません。ルームの状態を確認してください。" } };
  const saved = await call(session, votes, signal);
  if (saved.ok || signal?.aborted || [400, 401, 403, 404].includes(saved.error.status)) return saved;
  const confirmed = await getGenreVoting(session, signal);
  return confirmed.ok && confirmed.data.submitted ? confirmed : saved;
}
