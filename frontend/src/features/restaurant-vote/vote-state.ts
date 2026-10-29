import type { RestaurantCandidate } from "./restaurant-data";

export type RestaurantVoteChoice = "like" | "skip";
export type RestaurantVote = { readonly restaurantId: string; readonly choice: RestaurantVoteChoice };

export function recordRestaurantVote(votes: readonly RestaurantVote[], restaurants: readonly RestaurantCandidate[], vote: RestaurantVote): readonly RestaurantVote[] {
  if (restaurants[votes.length]?.id !== vote.restaurantId || votes.some((item) => item.restaurantId === vote.restaurantId)) return votes;
  return [...votes, vote];
}
