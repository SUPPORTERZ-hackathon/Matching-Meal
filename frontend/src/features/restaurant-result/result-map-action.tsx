"use client";

import { useLayoutEffect, useRef } from "react";
import { Map } from "lucide-react";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";
import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";
import { createGoogleMapsUrl } from "./maps-url";
import styles from "./restaurant-result.module.css";

type ResultMapActionProps = { restaurant?: RestaurantCandidate };
const ACTION_HEIGHT_PROPERTY = "--restaurant-result-action-height";

export function ResultMapAction({ restaurant }: ResultMapActionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const url = createGoogleMapsUrl(restaurant?.coordinates);
  useLayoutEffect(() => {
    const element = ref.current;
    const page = element?.closest<HTMLElement>(".meal-page");
    if (!element || !page) return;
    let previousHeight = 0;
    function reserveSpace() {
      if (!element || !page) return;
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height !== previousHeight) { page.style.setProperty(ACTION_HEIGHT_PROPERTY, `${height}px`); previousHeight = height; }
    }
    reserveSpace();
    const observer = new ResizeObserver(reserveSpace);
    observer.observe(element, { box: "border-box" });
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={styles.fixedAction} data-final-action>
    <BottomAction>
      {url ? <Button asChild variant="dark" size="meal" className={styles.mapButton}><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${restaurant?.name}をGoogleマップで開く（別タブで開く）`} aria-describedby="restaurant-map-note"><Map aria-hidden="true" /><span>Googleマップで開く</span></a></Button>
        : <Button type="button" variant="dark" size="meal" className={styles.mapButton} disabled aria-describedby="restaurant-map-note"><Map aria-hidden="true" /><span>Googleマップで開く</span></Button>}
      <p id="restaurant-map-note" className={styles.actionNote}>{url ? "お店の場所・経路を確認できます" : "位置情報がないためマップを開けません"}</p>
    </BottomAction>
  </div>;
}
