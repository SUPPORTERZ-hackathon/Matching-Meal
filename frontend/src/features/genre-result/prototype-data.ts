import type { Genre } from "../genre-vote/genres";
import type { GenreResultData } from "./result-data";

export const GENRE_RESULT_PATH = "/genre-result";

// 表示用の仮データ。参加者の実投票を集計した結果ではない。
export const MOCK_GENRE_RESULT: GenreResultData = {
  decidedGenreId: "ramen",
  participantCount: 3,
  rankings: [
    { genreId: "ramen", votes: 3 },
    { genreId: "yakiniku", votes: 2 },
    { genreId: "sushi-seafood", votes: 1 },
  ],
};

// 開発プレビューで指定されたジャンルを発表するだけで、集計ルールではない。
export function createMockGenreResult(genreId: string, genres: readonly Genre[]): GenreResultData {
  const MOCK_OTHER_VOTES = [2, 1] as const;
  const others = genres.filter((genre) => genre.id !== genreId).slice(0, MOCK_OTHER_VOTES.length);
  return {
    ...MOCK_GENRE_RESULT,
    decidedGenreId: genreId,
    rankings: [
      { genreId, votes: MOCK_GENRE_RESULT.participantCount },
      ...others.map((genre, index) => ({ genreId: genre.id, votes: MOCK_OTHER_VOTES[index] })),
    ],
  };
}
