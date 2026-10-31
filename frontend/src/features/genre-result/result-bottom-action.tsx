"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { BottomAction } from "@/components/common/bottom-action";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import { Button } from "@/components/ui/button";
import type { Genre } from "../genre-vote/genres";
import styles from "./genre-result.module.css";

type ResultBottomActionProps = { genre: Genre; onFindShops?: (genreId: string) => void };

export function ResultBottomAction({ genre, onFindShops }: ResultBottomActionProps) {
  const [requested, setRequested] = useState<boolean>(false);

  function findShops() {
    setRequested(true);
    onFindShops?.(genre.id);
  }

  return (
    <FixedBottomAction data-result-action>
      <BottomAction>
        <Button type="button" variant="primary" size="meal" onClick={findShops} aria-describedby="genre-result-next-status"><span className={styles.actionLabel}>このジャンルでお店を探す</span><ChevronRight className="size-5" aria-hidden="true" /></Button>
        <p id="genre-result-next-status" className={styles.actionNote} role="status" aria-live="polite" aria-atomic="true">
          {requested ? `${genre.name}を選択しました。${onFindShops ? "" : "店舗選定フローは準備中です。"}` : onFindShops ? "選択したジャンルを引き継ぎます" : "店舗選定フローは準備中です"}
        </p>
      </BottomAction>
    </FixedBottomAction>
  );
}
