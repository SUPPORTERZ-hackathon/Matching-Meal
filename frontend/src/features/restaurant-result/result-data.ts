import type { Genre } from "../genre-vote/genres";
import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";

export type RestaurantVoteTotals = {
  /** 対象店舗へ「ここがいい」と投票した人数。 */
  readonly likes: number;
  /** 対象店舗への「ここがいい」＋「見送り」。未投票者を含まない。 */
  readonly total: number;
};

export function areVoteTotalsValid(votes: RestaurantVoteTotals): boolean {
  return Number.isSafeInteger(votes.likes) && Number.isSafeInteger(votes.total)
    && votes.likes >= 0 && votes.total >= 0 && votes.likes <= votes.total;
}

export function calculateMatchRate(votes?: RestaurantVoteTotals): number | null {
  if (!votes || !areVoteTotalsValid(votes) || votes.total === 0) return null;
  return Math.round(votes.likes / votes.total * 100);
}

export type RestaurantResultData = {
  readonly genreId: string;
  readonly restaurantId: string;
  readonly votes?: RestaurantVoteTotals;
};
export type RestaurantResultView = {
  readonly genre: Genre;
  readonly restaurant: RestaurantCandidate;
  readonly votes?: RestaurantResultData["votes"];
  readonly unanimous: boolean;
  readonly matchRate: number | null;
};

export function resolveRestaurantResult(result: RestaurantResultData | null, genres: readonly Genre[], restaurants: readonly RestaurantCandidate[]): RestaurantResultView | null {
  if (!result) return null;
  const genre = genres.find((item) => item.id === result.genreId);
  const restaurant = restaurants.find((item) => item.id === result.restaurantId);
  const votes = result.votes;
  if (!genre || !restaurant || !restaurant.id.trim() || !restaurant.name.trim()
    || new Set(restaurants.map((item) => item.id)).size !== restaurants.length) return null;
  if (votes && !areVoteTotalsValid(votes)) return null;
  return { genre, restaurant, votes, unanimous: !!votes && votes.total > 0 && votes.likes === votes.total, matchRate: calculateMatchRate(votes) };
}
