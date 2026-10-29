"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Genre } from "../genre-vote/genres";
import type { RestaurantCandidate } from "./restaurant-data";
import { RestaurantVoteScreen } from "./restaurant-vote-screen";
import { restaurantWaitingUrl } from "./prototype-data";

type RestaurantVotePrototypeProps = { genre?: Genre; restaurants: readonly RestaurantCandidate[]; roomId: string };

export function RestaurantVotePrototype({ genre, restaurants, roomId }: RestaurantVotePrototypeProps) {
  const router = useRouter();
  const showWaiting = useCallback(() => { if (genre) router.replace(restaurantWaitingUrl(genre.id)); }, [genre, router]);
  return <RestaurantVoteScreen genre={genre} restaurants={restaurants} roomId={roomId} onComplete={showWaiting} />;
}
