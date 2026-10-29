"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { hasValidRestaurantCandidates, type RestaurantCandidate } from "./restaurant-data";
import { recordRestaurantVote, type RestaurantVote, type RestaurantVoteChoice } from "./vote-state";
import { RESTAURANT_VOTE_MOTION } from "./vote-config";

export type RestaurantVotePhase = "idle" | "exiting" | "entering" | "complete";
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(notify: () => void) {
  const preference = window.matchMedia(MOTION_QUERY);
  preference.addEventListener("change", notify);
  return () => preference.removeEventListener("change", notify);
}
const getMotion = () => window.matchMedia(MOTION_QUERY).matches;
const getServerMotion = () => false;

export function useRestaurantVote(restaurants: readonly RestaurantCandidate[]) {
  const [votes, setVotes] = useState<readonly RestaurantVote[]>([]);
  const [phase, setPhase] = useState<RestaurantVotePhase>("idle");
  const phaseRef = useRef<RestaurantVotePhase>("idle");
  const votesRef = useRef<readonly RestaurantVote[]>([]);
  const pendingRef = useRef<RestaurantVote | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, getServerMotion);
  const valid = hasValidRestaurantCandidates(restaurants);
  const changePhase = useCallback((next: RestaurantVotePhase) => { phaseRef.current = next; setPhase(next); }, []);

  const finishAnimation = useCallback((expectedPhase: RestaurantVotePhase) => {
    if (phaseRef.current !== expectedPhase) return;
    if (expectedPhase === "exiting" && pendingRef.current) {
      const next = recordRestaurantVote(votesRef.current, restaurants, pendingRef.current);
      pendingRef.current = null;
      votesRef.current = next;
      setVotes(next);
      changePhase(next.length === restaurants.length ? "complete" : "entering");
    } else if (expectedPhase === "entering") changePhase("idle");
  }, [restaurants, changePhase]);

  useEffect(() => {
    if (phase !== "exiting" && phase !== "entering") return;
    const duration = phase === "exiting" ? RESTAURANT_VOTE_MOTION.exitDuration : RESTAURANT_VOTE_MOTION.enterDuration;
    const timer = window.setTimeout(() => finishAnimation(phase), reducedMotion ? 0 : duration + RESTAURANT_VOTE_MOTION.eventGrace);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion, finishAnimation]);

  function vote(choice: RestaurantVoteChoice) {
    if (phaseRef.current !== "idle" || !valid) return;
    const restaurant = restaurants[votesRef.current.length];
    if (!restaurant) return;
    pendingRef.current = { restaurantId: restaurant.id, choice };
    changePhase("exiting");
  }

  return {
    votes, phase, vote, finishAnimation, valid,
    currentRestaurant: restaurants[votes.length],
    locked: phase !== "idle",
    complete: phase === "complete",
  };
}
