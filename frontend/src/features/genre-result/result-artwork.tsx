"use client";

import Image from "next/image";
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Genre } from "../genre-vote/genres";
import styles from "./genre-result.module.css";

type ResultArtworkProps = { genre: Genre };

export function ResultArtwork({ genre }: ResultArtworkProps) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);
  const imagePath = genre.imagePath?.startsWith("/genres/") ? genre.imagePath : undefined;

  return (
    <div className={styles.artwork} role="img" aria-label={`${genre.name}の料理イメージ${!imagePath || failed ? "（写真未登録のプレースホルダー）" : ""}`} data-result-artwork data-image-state={failed ? "failed" : loaded ? "loaded" : imagePath ? "loading" : "placeholder"}>
      <div className={styles.placeholder} aria-hidden="true"><span className={styles.plate}><UtensilsCrossed strokeWidth={1.3} /></span></div>
      {imagePath && !failed && <Image src={imagePath} alt="" fill sizes="210px" draggable={false} className={styles.photo} style={{ opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    </div>
  );
}
