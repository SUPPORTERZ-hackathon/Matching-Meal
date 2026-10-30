import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Genre } from "../genre-vote/genres";
import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";
import { restaurantResultUrl } from "../restaurant-result/prototype-data";
import styles from "./restaurant-demo-action.module.css";

type RestaurantDemoActionProps = { genre?: Genre; restaurant?: RestaurantCandidate };

export function RestaurantDemoAction({ genre, restaurant }: RestaurantDemoActionProps) {
  return <section className={styles.panel} aria-label="結果画面のデモ" data-restaurant-demo>
    {genre && restaurant ? <>
      <p>{genre.name}の候補先頭の架空店舗を表示します。実際の集計結果ではありません。</p>
      <Button asChild variant="primary" size="meal"><Link href={restaurantResultUrl(genre.id, restaurant.id, { demo: true })}>デモ：結果画面へ進む</Link></Button>
    </> : <>
      <p role="status">ジャンルまたは店舗候補を確認できないため、デモ結果を表示できません。</p>
      <Button type="button" variant="primary" size="meal" disabled>デモ：結果画面へ進む</Button>
    </>}
  </section>;
}
