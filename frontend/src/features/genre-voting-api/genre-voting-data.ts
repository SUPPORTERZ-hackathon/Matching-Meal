import { GENRES } from "../genre-vote/genres";
import type { GenreVote } from "../genre-vote/vote-state";
import type { GenreResultData, GenreDecision, GenreVoteSummary } from "../genre-result/result-data";
import type { WaitingParticipant } from "../genre-vote-waiting/waiting-state";
import { isRoomId, parseSnapshotResponse, type JsonValue, type RoomSnapshot } from "../room/room-data";

export type GenreVotingParticipant = RoomSnapshot["participants"][number] & { submitted: boolean };
export type GenreVotingSnapshot = Omit<RoomSnapshot, "participants"> & {
  submitted: boolean;
  submittedAt: string | null;
  submittedParticipantCount: number;
  totalParticipantCount: number;
  participants: GenreVotingParticipant[];
  result: (GenreDecision & {
    genreId: string;
    rankings: readonly GenreVoteSummary[];
    rankingTieBreakApplied: boolean;
  }) | null;
};
export type GenreVotingStage = "vote" | "waiting" | "result" | "lobby";
const RESULT_STATUSES: readonly string[] = ["restaurant_searching", "restaurant_voting", "decided"];
const TONES = ["peach", "pink", "blue"] as const;
const object = (value: JsonValue): { [key: string]: JsonValue } | undefined => value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
const isDate = (value: JsonValue): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

export function parseGenreVotingResponse(value: JsonValue): GenreVotingSnapshot | undefined {
  const base = parseSnapshotResponse(value), data = object(object(value)?.data ?? null);
  if (!base || !data || typeof data.submitted !== "boolean" || !Array.isArray(data.participants)
    || !Number.isSafeInteger(data.totalParticipantCount) || data.totalParticipantCount !== base.participants.length
    || !Number.isSafeInteger(data.submittedParticipantCount)) return;
  const participants: GenreVotingParticipant[] = [];
  for (const [index, row] of data.participants.entries()) {
    const raw = object(row);
    if (!raw || typeof raw.submitted !== "boolean") return;
    participants.push({ ...base.participants[index], submitted: raw.submitted });
  }
  if (participants.filter(person => person.submitted).length !== data.submittedParticipantCount
    || participants.find(person => person.id === base.currentParticipantId)?.submitted !== data.submitted
    || (data.submitted ? !isDate(data.submittedAt ?? null) : data.submittedAt !== null)) return;
  let result: GenreVotingSnapshot["result"] = null;
  if (data.result !== null) {
    const raw = object(data.result ?? null);
    if (!raw || typeof raw.genreId !== "string" || !GENRES.some(genre => genre.id === raw.genreId)
      || typeof raw.likeCount !== "number" || !Number.isSafeInteger(raw.likeCount) || raw.likeCount < 0 || raw.likeCount > participants.length
      || typeof raw.decisionMethod !== "string" || !["most_likes", "random_tie", "random_all_skipped"].includes(raw.decisionMethod) || !isDate(raw.decidedAt ?? null)
      || !data.submitted || data.submittedParticipantCount !== participants.length || !RESULT_STATUSES.includes(base.room.status)) return;
    const decisionMethod = raw.decisionMethod as GenreDecision["decisionMethod"];
    if ((decisionMethod === "random_all_skipped") !== (raw.likeCount === 0)) return;
    const rawRankings = raw.rankings === undefined ? [] : raw.rankings;
    if (!Array.isArray(rawRankings) || (rawRankings.length !== 0 && rawRankings.length !== 3)
      || (raw.rankingTieBreakApplied !== undefined && typeof raw.rankingTieBreakApplied !== "boolean")) return;
    const rankings: GenreVoteSummary[] = [];
    const seen = new Set<string>();
    let previousVotes = participants.length + 1;
    for (const row of rawRankings) {
      const ranking = object(row);
      if (!ranking || typeof ranking.genreId !== "string" || !GENRES.some(genre => genre.id === ranking.genreId)
        || seen.has(ranking.genreId) || typeof ranking.votes !== "number" || !Number.isSafeInteger(ranking.votes)
        || ranking.votes < 0 || ranking.votes > participants.length || ranking.votes > previousVotes) return;
      seen.add(ranking.genreId);
      previousVotes = ranking.votes;
      rankings.push({ genreId: ranking.genreId, votes: ranking.votes });
    }
    if (rankings.length > 0 && (rankings[0].genreId !== raw.genreId || rankings[0].votes !== raw.likeCount)) return;
    const rankingTieBreakApplied = raw.rankingTieBreakApplied ?? false;
    if (rankings.length === 0 && rankingTieBreakApplied) return;
    result = { genreId: raw.genreId, likeCount: raw.likeCount, decisionMethod, decidedAt: raw.decidedAt as string,
      rankings, rankingTieBreakApplied };
  } else if (RESULT_STATUSES.includes(base.room.status) || data.submittedParticipantCount === participants.length) return;
  if (base.room.status === "lobby" && data.submittedParticipantCount !== 0) return;
  return { ...base, participants, submitted: data.submitted, submittedAt: data.submittedAt as string | null,
    submittedParticipantCount: data.submittedParticipantCount as number, totalParticipantCount: participants.length, result };
}

export function genreVotingStage(state: GenreVotingSnapshot): GenreVotingStage {
  return state.result ? "result" : state.room.status === "lobby" ? "lobby" : state.submitted ? "waiting" : "vote";
}
export function genreVotingUrl(stage: GenreVotingStage, roomId: string): string {
  const paths: Record<GenreVotingStage, string> = { vote: "/genre-vote", waiting: "/genre-vote-waiting", result: "/genre-result", lobby: "/room-waiting" };
  return `${paths[stage]}?room=${encodeURIComponent(roomId)}`;
}
export function normalizeVotingRoomId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && isRoomId(value) ? value.toLowerCase() : undefined;
}
export function validVotePrefix(votes: readonly GenreVote[], sealed = false): boolean {
  return votes.length <= GENRES.length && (!sealed || votes.length === GENRES.length)
    && votes.every((vote, index) => vote.genreId === GENRES[index].id && (vote.choice === "like" || vote.choice === "skip"));
}
export function waitingParticipants(state: GenreVotingSnapshot): readonly WaitingParticipant[] {
  return state.participants.map((person, index) => ({ id: person.id, nickname: person.nickname, tone: TONES[index % TONES.length], state: person.submitted ? "complete" : "waiting" }));
}
export function resultPresentation(state: GenreVotingSnapshot): GenreResultData | undefined {
  return state.result ? { decidedGenreId: state.result.genreId, participantCount: state.totalParticipantCount,
    rankings: state.result.rankings, rankingTieBreakApplied: state.result.rankingTieBreakApplied,
    decision: { likeCount: state.result.likeCount, decisionMethod: state.result.decisionMethod, decidedAt: state.result.decidedAt } } : undefined;
}
