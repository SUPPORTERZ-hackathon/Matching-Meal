"use client";

import Image from "next/image";
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { safeRestaurantPhotoUrl, type RestaurantCandidate } from "./restaurant-data";
import styles from "./restaurant-vote.module.css";

type RestaurantPhotoProps = { restaurant: RestaurantCandidate };

export function RestaurantPhoto({ restaurant }: RestaurantPhotoProps) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);
  const src = safeRestaurantPhotoUrl(restaurant.photoUrl);
  return <div className={styles.photoArea} data-restaurant-photo data-photo-state={failed ? "failed" : loaded ? "loaded" : src ? "loading" : "missing"}>
    <div className={styles.placeholder} aria-hidden="true"><span className={styles.plate}><UtensilsCrossed strokeWidth={1.3} /></span><span>お店の写真</span></div>
    {src && !failed && <Image src={src} alt={`${restaurant.name}の店舗写真`} fill unoptimized draggable={false} className={styles.photo} style={{ opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    {(!src || failed) && <span className="sr-only">{failed ? "写真を読み込めませんでした" : "店舗写真は未登録です"}</span>}
    {restaurant.source === "mock" && <span className={styles.sampleBadge}>表示サンプル</span>}
  </div>;
}
