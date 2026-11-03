"use client";

import Image from "next/image";
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Genre } from "../genre-vote/genres";
import { getGenreImagePath } from "../genre-vote/genre-image";
import styles from "./genre-result.module.css";

export type ResultArtworkReadyState = "photo" | "fallback";
type ResultArtworkProps = { genre: Genre; onReady?: (state: ResultArtworkReadyState) => void; showPhoto?: boolean };

export function ResultArtwork({ genre, onReady, showPhoto = true }: ResultArtworkProps) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);
  const imagePath = getGenreImagePath(genre);

  return (
    <div className={styles.artwork} role="img" aria-label={`${genre.name}の料理イメージ${!imagePath || failed || !showPhoto ? "（写真未登録のプレースホルダー）" : ""}`} data-result-artwork data-image-state={failed ? "failed" : !showPhoto ? "placeholder" : loaded ? "loaded" : imagePath ? "loading" : "placeholder"}>
      <div className={styles.placeholder} aria-hidden="true"><span className={styles.plate}><UtensilsCrossed strokeWidth={1.3} /></span></div>
      {imagePath && !failed && showPhoto && <Image src={imagePath} alt="" fill sizes="210px" loading="eager" fetchPriority="high" decoding="sync" draggable={false} className={styles.photo} style={{ opacity: loaded ? 1 : 0 }} onLoad={() => { setLoaded(true); onReady?.("photo"); }} onError={() => { setFailed(true); onReady?.("fallback"); }} />}
    </div>
  );
}
