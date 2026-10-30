import type { ReactNode } from "react";
import { Heart, Map, MapPin, JapaneseYen } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import type { Genre } from "../genre-vote/genres";
import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";
import { safeRestaurantPhotoUrl } from "../restaurant-vote/restaurant-data";
import { resolveRestaurantResult, type RestaurantResultData } from "./result-data";
import { ResultPhoto } from "./result-photo";
import { ResultMapAction } from "./result-map-action";
import styles from "./restaurant-result.module.css";

export type RestaurantResultScreenProps = {
  result: RestaurantResultData | null;
  genres: readonly Genre[];
  restaurants: readonly RestaurantCandidate[];
  roomId?: string;
  isPrototype?: boolean;
  children?: ReactNode;
};
const HOTPEPPER_CREDIT_URL = "https://webservice.recruit.co.jp/";

export function RestaurantResultScreen({ result, genres, restaurants, roomId, isPrototype = false, children }: RestaurantResultScreenProps) {
  const view = resolveRestaurantResult(result, genres, restaurants);
  const restaurant = view?.restaurant;
  const votes = view?.votes;
  const hasVotes = votes && votes.total > 0;
  const matchLabel = view?.matchRate === null || view?.matchRate === undefined ? "集計待ち" : `${view.matchRate}%`;
  return <div className={styles.background}>
    <PageContainer className={styles.page} header={<AppHeader roomNumber={roomId} className={styles.header} />} bottomAction={<ResultMapAction restaurant={restaurant} />}>
      <StepProgress currentStep="result" />
      <div className={styles.content} data-final-result>
        {view && restaurant ? <>
          <div className={styles.intro}><span className={styles.decided}>決定！</span><h1>みんなの「行きたい」が<br />マッチしました！</h1></div>
          <article className={styles.resultCard} aria-labelledby="restaurant-result-name" data-decided-restaurant={restaurant.id}>
            <div className={styles.photoArea}>
              <ResultPhoto key={`${restaurant.id}:${restaurant.photoUrl ?? ""}`} restaurant={restaurant} />
              <span className={styles.matchBadge} role="img" aria-label={`マッチ率 ${matchLabel}`} data-match-rate={view.matchRate ?? "pending"}>BEST MATCH <b>{matchLabel}</b></span>
            </div>
            <div className={styles.cardContent}>
              <span className={styles.genreBadge} data-result-genre={view.genre.id}>{view.genre.name}</span>
              <h2 id="restaurant-result-name">{restaurant.name}</h2>
              <dl className={styles.hours}><dt>営業時間</dt><dd>{restaurant.openingHours?.trim() || "営業時間情報なし"}</dd></dl>
              <dl className={styles.information}>
                <div><MapPin aria-hidden="true" /><div><dt>住所</dt><dd>{restaurant.address?.trim() || "住所情報なし"}</dd></div></div>
                <div><JapaneseYen aria-hidden="true" /><div><dt>ディナー予算</dt><dd>{restaurant.dinnerBudget?.trim() || "ディナー予算情報なし"}</dd></div></div>
                <div><Map aria-hidden="true" /><div><dt>アクセス</dt><dd>{restaurant.access?.trim() || "アクセス情報なし"}</dd></div></div>
              </dl>
            </div>
          </article>
          <section className={styles.summary} aria-label="決定店舗の投票結果" data-vote-summary>
            <span className={styles.summaryHeart} aria-hidden="true"><Heart fill="currentColor" /></span>
            <div><p>{hasVotes ? view.unanimous ? `投票した${votes.total}人全員が「ここがいい！」` : `投票した${votes.total}人中${votes.likes}人が「ここがいい！」` : "投票結果は集計待ちです"}</p><small>{hasVotes ? "未投票の参加者は集計に含みません" : "この店舗への投票が届くと表示します"}</small></div>
          </section>
          {restaurant.source === "hotpepper" && <div className={styles.sourceNote}><p>Powered by <a href={HOTPEPPER_CREDIT_URL} target="_blank" rel="noopener noreferrer">ホットペッパーグルメ Webサービス</a></p>{safeRestaurantPhotoUrl(restaurant.photoUrl) && <p>画像提供：ホットペッパー グルメ</p>}</div>}
          {isPrototype && <p className={styles.prototypeNote}>サンプル結果・実際の集計ではありません</p>}
        </> : <section className={`meal-card ${styles.empty}`} role="status"><h1>結果を表示できません</h1><p>結果情報がまだないか、ジャンル・店舗を確認できません。</p></section>}
        {children}
      </div>
    </PageContainer>
  </div>;
}
