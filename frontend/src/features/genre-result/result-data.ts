import type { Genre } from "../genre-vote/genres";

export type GenreVoteSummary = { readonly genreId: string; readonly votes: number };
export type GenreResultData = {
  readonly decidedGenreId: string;
  readonly participantCount: number;
  readonly rankings: readonly GenreVoteSummary[];
};
export type ResolvedGenreResult = {
  readonly genre: Genre;
  readonly participantCount: number;
  readonly rankings: readonly { readonly genre: Genre; readonly votes: number }[];
};

const PERCENTAGE_SCALE = 100;

export function getVotePercentage(votes: number, participantCount: number): number {
  return participantCount > 0 ? votes / participantCount * PERCENTAGE_SCALE : 0;
}

// 表示入力の整合性だけを確認する。順位の並べ替えや勝者・同票の判定は行わない。
export function resolveGenreResult(result: GenreResultData, genres: readonly Genre[]): ResolvedGenreResult | null {
  const genre = genres.find((item) => item.id === result.decidedGenreId);
  if (!genre || !Number.isSafeInteger(result.participantCount) || result.participantCount < 0) return null;
  const seen = new Set<string>();
  const rankings: { genre: Genre; votes: number }[] = [];
  for (const row of result.rankings) {
    const candidate = genres.find((item) => item.id === row.genreId);
    if (!candidate || seen.has(row.genreId) || !Number.isSafeInteger(row.votes) || row.votes < 0 || row.votes > result.participantCount) return null;
    seen.add(row.genreId);
    rankings.push({ genre: candidate, votes: row.votes });
  }
  return { genre, participantCount: result.participantCount, rankings };
}
