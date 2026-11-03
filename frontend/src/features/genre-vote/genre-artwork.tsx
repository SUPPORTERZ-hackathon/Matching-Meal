"use client";

import Image from "next/image";
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Genre } from "./genres";
import { getGenreImagePath } from "./genre-image";
import styles from "./genre-vote.module.css";

type GenreArtworkProps = { genre: Genre; current?: boolean };

export function GenreArtwork({ genre, current = true }: GenreArtworkProps) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);
  const imagePath = getGenreImagePath(genre);

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
          loading="eager"
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
        <h2 id={current ? "genre-card-title" : undefined}>{genre.name.split("・").map((part, index, parts) => <span key={index} className={styles.namePart}>{part}{index < parts.length - 1 ? "・" : ""}</span>)}</h2>
        {genre.appeal && <p data-genre-appeal>{genre.appeal}</p>}
      </div>
    </>
  );
}
