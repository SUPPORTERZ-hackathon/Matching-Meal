"use client";

import Image from "next/image";
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Genre } from "./genres";
import styles from "./genre-vote.module.css";

type GenreArtworkProps = { genre: Genre };

export function GenreArtwork({ genre }: GenreArtworkProps) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);
  const imagePath = genre.imagePath?.startsWith("/genres/") ? genre.imagePath : undefined;

  return (
    <>
      <div className={styles.placeholder} aria-hidden="true">
        <div className={styles.plate}><UtensilsCrossed strokeWidth={1.25} /></div>
      </div>
      {imagePath && !failed && (
        <Image
          src={imagePath}
          alt=""
          fill
          sizes="(max-width: 430px) calc(100vw - 44px), 386px"
          draggable={false}
          className={styles.photo}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      <div className={styles.imageShade} aria-hidden="true" />
      <div className={styles.cardLabel}>
        <span className={styles.cardTag}>今日の気分</span>
        <h2 id="genre-card-title">{genre.name.split("・").map((part, index, parts) => <span key={index} className={styles.namePart}>{part}{index < parts.length - 1 ? "・" : ""}</span>)}</h2>
        <p>食べたい気分なら、右へ。</p>
      </div>
    </>
  );
}
