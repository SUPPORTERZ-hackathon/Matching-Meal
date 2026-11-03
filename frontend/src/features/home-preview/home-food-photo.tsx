"use client";

import Image from "next/image";
import { useState } from "react";
import type { Genre } from "../genre-vote/genres";
import { getGenreImagePath } from "../genre-vote/genre-image";

type HomeFoodPhotoProps = { genre?: Genre; featured?: boolean };

export function HomeFoodPhoto({ genre, featured = false }: HomeFoodPhotoProps) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);
  const path = getGenreImagePath(genre);
  const name = genre?.name ?? "料理";
  return <div className="home-preview-photo" role="img" aria-label={`${name}の料理イメージ${!path || failed ? "（写真未登録のプレースホルダー）" : ""}`} data-home-genre={genre?.id} data-photo-state={failed ? "failed" : loaded ? "loaded" : path ? "loading" : "missing"}>
    <span className="home-preview-photo-placeholder" aria-hidden="true">{name}</span>
    {path && !failed && <Image src={path} alt="" fill loading="eager" sizes={featured ? "(max-width: 360px) 120px, 180px" : "(max-width: 360px) 70px, 100px"} draggable={false} className="home-preview-photo-image" style={{ opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
  </div>;
}
