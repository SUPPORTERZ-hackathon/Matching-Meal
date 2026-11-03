"use client";

import { Map } from "lucide-react";
import { BottomAction } from "@/components/common/bottom-action";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import { Button } from "@/components/ui/button";
import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";
import { createGoogleMapsUrl } from "./maps-url";
import styles from "./restaurant-result.module.css";

type ResultMapActionProps = { restaurant?: RestaurantCandidate };

export function ResultMapAction({ restaurant }: ResultMapActionProps) {
  const url = createGoogleMapsUrl(restaurant?.coordinates);
  return <FixedBottomAction data-final-action>
    <BottomAction>
      {url ? <Button asChild variant="dark" size="meal" className={styles.mapButton}><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${restaurant?.name}をGoogleマップで開く（別タブで開く）`} aria-describedby="restaurant-map-note"><Map aria-hidden="true" /><span>Googleマップで開く</span></a></Button>
        : <Button type="button" variant="dark" size="meal" className={styles.mapButton} disabled aria-describedby="restaurant-map-note"><Map aria-hidden="true" /><span>Googleマップで開く</span></Button>}
      <p id="restaurant-map-note" className={styles.actionNote}>{url ? "お店の場所・経路を確認できます" : "位置情報がないためマップを開けません"}</p>
    </BottomAction>
  </FixedBottomAction>;
}
