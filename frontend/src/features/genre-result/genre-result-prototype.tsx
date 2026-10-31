"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GenreResultScreenProps } from "./genre-result-screen";
import { GenreResultScreen } from "./genre-result-screen";
import { restaurantVoteUrl } from "../restaurant-vote/prototype-data";

type GenreResultPrototypeProps = Pick<GenreResultScreenProps, "result" | "genres" | "roomId">;

export function GenreResultPrototype(props: GenreResultPrototypeProps) {
  const router = useRouter();
  const findShops = useCallback((genreId: string) => router.push(restaurantVoteUrl(genreId, { demo: true })), [router]);
  return <GenreResultScreen {...props} isPrototype onFindShops={findShops} />;
}
