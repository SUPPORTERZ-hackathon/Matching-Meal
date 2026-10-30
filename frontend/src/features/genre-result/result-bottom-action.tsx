"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";
import type { Genre } from "../genre-vote/genres";
import styles from "./genre-result.module.css";

type ResultBottomActionProps = { genre: Genre; onFindShops?: (genreId: string) => void };
const ACTION_HEIGHT_PROPERTY = "--result-action-height";

export function ResultBottomAction({ genre, onFindShops }: ResultBottomActionProps) {
  const actionRef = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState<boolean>(false);

  useLayoutEffect(() => {
    const element = actionRef.current;
    const page = element?.closest<HTMLElement>(".meal-page");
    if (!element || !page) return;
    let previousHeight = 0;
    function reserveSpace() {
      if (!element || !page) return;
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height !== previousHeight) {
        page.style.setProperty(ACTION_HEIGHT_PROPERTY, `${height}px`);
        previousHeight = height;
      }
    }
    reserveSpace();
    const observer = new ResizeObserver(reserveSpace);
    observer.observe(element, { box: "border-box" });
    return () => observer.disconnect();
  }, []);

  function findShops() {
    setRequested(true);
    onFindShops?.(genre.id);
  }

  return (
    <div ref={actionRef} className={styles.fixedAction} data-result-action>
      <BottomAction>
        <Button type="button" variant="primary" size="meal" onClick={findShops} aria-describedby="genre-result-next-status"><span className={styles.actionLabel}>このジャンルでお店を探す</span><ChevronRight className="size-5" aria-hidden="true" /></Button>
        <p id="genre-result-next-status" className={styles.actionNote} role="status" aria-live="polite" aria-atomic="true">
          {requested ? `${genre.name}を選択しました。${onFindShops ? "" : "店舗選定フローは準備中です。"}` : onFindShops ? "選択したジャンルを引き継ぎます" : "店舗選定フローは準備中です"}
        </p>
      </BottomAction>
    </div>
  );
}
