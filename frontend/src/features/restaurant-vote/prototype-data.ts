import type { Genre } from "../genre-vote/genres";
import type { RestaurantCandidate } from "./restaurant-data";

export const RESTAURANT_VOTE_PATH = "/restaurant-vote";
export const RESTAURANT_WAITING_PATH = "/restaurant-vote-waiting";
export const DEFAULT_RESTAURANT_GENRE_ID = "ramen";

export function restaurantVoteUrl(genreId: string): string {
  return `${RESTAURANT_VOTE_PATH}?genre=${encodeURIComponent(genreId)}`;
}
export function restaurantWaitingUrl(genreId: string): string {
  return `${RESTAURANT_WAITING_PATH}?genre=${encodeURIComponent(genreId)}`;
}

// 全項目が表示確認用の架空データ。実店舗/API写真/実検索結果ではない。
// 検証済みの店舗URLがないためdetailUrlを設定しない。写真は後からphotoUrlへ渡せる。
export function createMockRestaurants(genre: Genre): readonly RestaurantCandidate[] {
  return [
    { id: "mock-restaurant-akari", name: `サンプル店 あかり`, openingHours: "11:30〜14:00、17:00〜23:00", closedDays: "水曜日", dinnerBudget: "1,000〜1,500円", access: "サンプル駅 東口から徒歩5分", stationName: "サンプル駅" },
    { id: "mock-restaurant-komorebi", name: `サンプル店 こもれび`, openingHours: "11:00〜15:00、18:00〜22:00", closedDays: "月曜日", dinnerBudget: "1,500〜2,000円", access: "サンプル駅 南口から徒歩3分", stationName: "サンプル駅" },
    { id: "mock-restaurant-hidamari", name: `サンプル店 ひだまり`, openingHours: "12:00〜21:00", closedDays: "火曜日", dinnerBudget: "1,000〜2,000円", access: "サンプル駅 西口から徒歩7分", stationName: "サンプル駅" },
    { id: "mock-restaurant-nagomi", name: `サンプル店 なごみ`, openingHours: "17:00〜23:00", closedDays: "日曜日", dinnerBudget: "2,000〜3,000円", access: "サンプル駅 北口から徒歩4分", stationName: "サンプル駅" },
  ].map((restaurant) => ({ ...restaurant, name: `${restaurant.name}（${genre.name}）`, source: "mock" }));
}
