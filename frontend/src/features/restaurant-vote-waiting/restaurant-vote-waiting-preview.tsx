"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PROTOTYPE_ROOM_ID } from "../genre-vote/prototype-config";
import type { WaitingParticipant } from "../genre-vote-waiting/waiting-state";
import { RestaurantVoteWaitingScreen } from "./restaurant-vote-waiting-screen";
import { MOCK_RESTAURANT_PARTICIPANTS } from "./prototype-data";
import { GENRES } from "../genre-vote/genres";
import { createMockRestaurants, DEFAULT_RESTAURANT_GENRE_ID } from "../restaurant-vote/prototype-data";
import { restaurantResultUrl } from "../restaurant-result/prototype-data";
import styles from "../genre-vote-waiting/genre-vote-waiting.module.css";
import previewStyles from "./restaurant-waiting-preview.module.css";

const MANY_PARTICIPANT_COUNT = 12;
const LONG_ROOM_ID = "prototype-restaurant-room-with-a-long-identifier-2481";

type RestaurantVoteWaitingPreviewProps = { initialGenreId?: string };

export function RestaurantVoteWaitingPreview({ initialGenreId }: RestaurantVoteWaitingPreviewProps) {
  const router = useRouter();
  const [genreId, setGenreId] = useState<string>(initialGenreId ?? DEFAULT_RESTAURANT_GENRE_ID);
  const [restaurantId, setRestaurantId] = useState<string>(() => createMockRestaurants(GENRES[0])[0].id);
  const genre = GENRES.find((item) => item.id === genreId);
  const restaurants = genre ? createMockRestaurants(genre) : [];
  const [participants, setParticipants] = useState<readonly WaitingParticipant[]>(MOCK_RESTAURANT_PARTICIPANTS);
  const [roomId, setRoomId] = useState<string>(PROTOTYPE_ROOM_ID);
  return <>
    <RestaurantVoteWaitingScreen participants={participants} roomId={roomId} />
    <section className={`${styles.previewControls} ${previewStyles.controls}`} aria-labelledby="restaurant-waiting-preview-heading">
      <h2 id="restaurant-waiting-preview-heading">店舗投票待機・開発用プレビュー</h2>
      <p>独立した仮データです。操作時だけ状態が変化し、再読み込みで2/3人に戻ります。人数変更だけでは結果へ進みません。下の明示操作でサンプル結果へ進めます。</p>
      <div className={styles.previewActions}>{MOCK_RESTAURANT_PARTICIPANTS.map((person, index) => <Button key={person.id} type="button" variant="outline" onClick={() => setParticipants(MOCK_RESTAURANT_PARTICIPANTS.map((participant, personIndex) => ({ ...participant, state: personIndex <= index ? "complete" : "waiting" })))}>{index + 1}/{MOCK_RESTAURANT_PARTICIPANTS.length}人を表示</Button>)}</div>
      <div className={styles.previewActions}>{participants.map((person) => <Button key={person.id} type="button" variant="soft" aria-pressed={person.state === "complete"} aria-label={`${person.nickname}の店舗投票完了を切り替え`} onClick={() => setParticipants((current) => current.map((item) => item.id === person.id ? { ...item, state: item.state === "complete" ? "waiting" : "complete" } : item))}>{person.avatarText}：{person.state === "complete" ? "完了" : "待機中"}</Button>)}</div>
      <div className={styles.previewActions}>
        <Button type="button" variant="outline" onClick={() => { setParticipants(Array.from({ length: MANY_PARTICIPANT_COUNT }, (_, index) => ({ ...MOCK_RESTAURANT_PARTICIPANTS[index % MOCK_RESTAURANT_PARTICIPANTS.length], id: `restaurant-preview-person-${index}`, nickname: index === 0 ? "とても長いニックネームの参加者" : `参加者${index + 1}` }))); setRoomId(LONG_ROOM_ID); }}>多数・長文を表示</Button>
        <Button type="button" variant="outline" onClick={() => setParticipants([])}>参加者なしを表示</Button>
        <Button type="button" variant="outline" onClick={() => { setParticipants(MOCK_RESTAURANT_PARTICIPANTS); setRoomId(PROTOTYPE_ROOM_ID); }}>初期表示に戻す</Button>
      </div>
      <label htmlFor="waiting-result-genre">結果確認用のジャンル</label>
      <select id="waiting-result-genre" value={genre?.id ?? ""} onChange={(event) => setGenreId(event.target.value)}><option value="" disabled>ジャンルを選択してください</option>{GENRES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <label htmlFor="waiting-result-shop">結果確認用の店舗</label>
      <select id="waiting-result-shop" value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)} disabled={!genre}>{restaurants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <div className={styles.previewActions}><Button type="button" variant="primary" disabled={!genre || !restaurants.some((item) => item.id === restaurantId)} onClick={() => {
        if (!genre) return;
        setParticipants(MOCK_RESTAURANT_PARTICIPANTS.map((person) => ({ ...person, state: "complete" })));
        router.push(restaurantResultUrl(genre.id, restaurantId, { demo: true }));
      }}>全員完了からサンプル結果へ</Button></div>
    </section>
  </>;
}
