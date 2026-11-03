import type { RestaurantResultData } from "./result-data";

export const RESTAURANT_RESULT_PATH = "/restaurant-result";

export function isRestaurantDemo(value: string | string[] | undefined): boolean {
  return value === "1";
}

export function restaurantResultUrl(genreId: string, restaurantId: string, options?: { demo?: boolean }): string {
  const query = new URLSearchParams({ genre: genreId, restaurant: restaurantId });
  if (options?.demo) query.set("demo", "1");
  return `${RESTAURANT_RESULT_PATH}?${query}`;
}

// 実投票・参加者完了数から集計しない、表示用の明示的なサンプル内訳。
// 店舗情報そのものは既存createMockRestaurantsの候補を参照する。
export function createMockRestaurantResult(genreId: string, restaurantId: string): RestaurantResultData {
  const MOCK_LIKES = 3;
  const MOCK_CAST_VOTES = 3;
  return { genreId, restaurantId, votes: { likes: MOCK_LIKES, total: MOCK_CAST_VOTES } };
}
