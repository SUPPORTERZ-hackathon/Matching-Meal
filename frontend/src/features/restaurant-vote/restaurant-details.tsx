import { ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeRestaurantDetailUrl, safeRestaurantPhotoUrl, type RestaurantCandidate } from "./restaurant-data";
import styles from "./restaurant-vote.module.css";

const HOTPEPPER_CREDIT_URL = "https://webservice.recruit.co.jp/";
type RestaurantDetailsProps = { restaurant: RestaurantCandidate };

export function RestaurantDetails({ restaurant }: RestaurantDetailsProps) {
  const url = safeRestaurantDetailUrl(restaurant.detailUrl);
  return <div className={styles.details}>
    {url ? <Button asChild variant="link" className={styles.detailButton}><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${restaurant.name}のお店の詳細を見る（別タブで開く）`}>お店の詳細を見る<ExternalLink aria-hidden="true" /></a></Button>
      : <><Button type="button" variant="link" className={styles.detailButton} disabled aria-describedby="restaurant-detail-note">お店の詳細を見る<ChevronRight aria-hidden="true" /></Button><p id="restaurant-detail-note">{restaurant.source === "mock" ? "サンプル店舗のため詳細ページはありません" : "店舗詳細URLがありません"}</p></>}
    {restaurant.source === "hotpepper" ? <div className={styles.credit}><p>Powered by <a href={HOTPEPPER_CREDIT_URL} target="_blank" rel="noopener noreferrer">ホットペッパーグルメ Webサービス</a></p>{safeRestaurantPhotoUrl(restaurant.photoUrl) && <p>画像提供：ホットペッパー グルメ</p>}</div>
      : <p className={styles.mockNote}>表示用の架空店舗です。写真・情報はサンプルです。</p>}
  </div>;
}
