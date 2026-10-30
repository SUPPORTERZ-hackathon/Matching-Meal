"use client";

import Image from "next/image";
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { safeRestaurantPhotoUrl, type RestaurantCandidate } from "../restaurant-vote/restaurant-data";
import styles from "./restaurant-result.module.css";

type ResultPhotoProps = { restaurant: RestaurantCandidate };

export function ResultPhoto({ restaurant }: ResultPhotoProps) {
  const [failed, setFailed] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const src = safeRestaurantPhotoUrl(restaurant.photoUrl);
  return <div className={styles.photo} data-final-photo data-photo-state={failed ? "failed" : loaded ? "loaded" : src ? "loading" : "missing"}>
    <div className={styles.placeholder} aria-hidden="true"><span><UtensilsCrossed strokeWidth={1.3} /></span><p>お店の写真</p></div>
    {src && !failed && <Image src={src} alt={`${restaurant.name}の店舗写真`} fill unoptimized draggable={false} className={styles.image} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    {(!src || failed) && <span className="sr-only">{failed ? "写真を読み込めませんでした" : "店舗写真は未登録です"}</span>}
  </div>;
}
