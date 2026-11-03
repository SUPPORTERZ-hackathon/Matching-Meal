import type { Genre } from "../genre-vote/genres";

export type GenreVoteSummary = { readonly genreId: string; readonly votes: number };
export type ResolvedGenreVoteSummary = { readonly genre: Genre; readonly votes: number };
export const GENRE_RANKING_LIMIT = 3;
export type GenreDecision = { readonly likeCount: number; readonly decisionMethod: "most_likes" | "random_tie" | "random_all_skipped"; readonly decidedAt: string };
export const DECISION_LABELS: Record<GenreDecision["decisionMethod"], string> = {
  most_likes: "「食べたい」が最も多いジャンル", random_tie: "最多同票のジャンルから抽選", random_all_skipped: "全員が見送りのため全ジャンルから抽選",
};
export type GenreResultData = {
  readonly decidedGenreId: string;
  readonly participantCount: number;
  readonly rankings: readonly GenreVoteSummary[];
  readonly decision?: GenreDecision;
  readonly rankingTieBreakApplied?: boolean;
};
export type ResolvedGenreResult = {
  readonly genre: Genre;
  readonly participantCount: number;
  readonly rankings: readonly ResolvedGenreVoteSummary[];
  readonly decision?: GenreDecision;
  readonly rankingTieBreakApplied?: boolean;
};

const PERCENTAGE_SCALE = 100;

export function getVotePercentage(votes: number, participantCount: number): number {
  return participantCount > 0 ? votes / participantCount * PERCENTAGE_SCALE : 0;
}

// 順位は供給元の確定順をそのまま使う。並べ替え・抽選・不足分の補完は行わない。
export function topGenreRankings(rankings: readonly ResolvedGenreVoteSummary[]): readonly ResolvedGenreVoteSummary[] {
  return rankings.slice(0, GENRE_RANKING_LIMIT);
}

// 表示入力の整合性だけを確認する。順位の並べ替えや勝者・同票の判定は行わない。
export function resolveGenreResult(result: GenreResultData, genres: readonly Genre[]): ResolvedGenreResult | null {
  const genre = genres.find((item) => item.id === result.decidedGenreId);
  if (!genre || !Number.isSafeInteger(result.participantCount) || result.participantCount < 0) return null;
  if (result.rankingTieBreakApplied !== undefined && typeof result.rankingTieBreakApplied !== "boolean") return null;
  if (result.decision && (!Number.isSafeInteger(result.decision.likeCount) || result.decision.likeCount < 0
    || result.decision.likeCount > result.participantCount || !Object.hasOwn(DECISION_LABELS, result.decision.decisionMethod)
    || !Number.isFinite(Date.parse(result.decision.decidedAt)))) return null;
  const seen = new Set<string>();
  const rankings: { genre: Genre; votes: number }[] = [];
  let previousVotes = Number.POSITIVE_INFINITY;
  for (const row of result.rankings) {
    const candidate = genres.find((item) => item.id === row.genreId);
    if (!candidate || seen.has(row.genreId) || !Number.isSafeInteger(row.votes) || row.votes < 0 || row.votes > result.participantCount || row.votes > previousVotes) return null;
    previousVotes = row.votes;
    seen.add(row.genreId);
    rankings.push({ genre: candidate, votes: row.votes });
  }
  if (rankings.length > 0 && (rankings[0].genre.id !== result.decidedGenreId
    || (result.decision && rankings[0].votes !== result.decision.likeCount))) return null;
  return { genre, participantCount: result.participantCount, rankings,
    ...(result.decision ? { decision: result.decision } : {}),
    ...(result.rankingTieBreakApplied !== undefined ? { rankingTieBreakApplied: result.rankingTieBreakApplied } : {}) };
}
