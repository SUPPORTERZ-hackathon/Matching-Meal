"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import type { Genre } from "./genres";
import { recordGenreVote, undoGenreVote, type GenreVote, type VoteChoice } from "./vote-state";
import { canCommitSwipe, detectAxis, directionOpacity, dragMotion, REST_MOTION, SWIPE, type CardMotion, type GestureAxis } from "./swipe-config";

export type VotePhase = "idle" | "dragging" | "returning" | "exiting" | "entering" | "undoing" | "undo-entering" | "complete";
type LastVoteAction = { type: "vote"; vote: GenreVote } | { type: "undo"; genreId: string } | null;
type Gesture = { pointerId: number; startX: number; startY: number; axis: GestureAxis };
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(notify: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
const getMotionPreference = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getServerMotionPreference = () => false;

export function useGenreVote(genres: readonly Genre[]) {
  const [votes, setVotes] = useState<readonly GenreVote[]>([]);
  const [phase, setPhase] = useState<VotePhase>("idle");
  const [motion, setMotion] = useState<CardMotion>(REST_MOTION);
  const [cardWidth, setCardWidth] = useState<number>(0);
  const [lastAction, setLastAction] = useState<LastVoteAction>(null);
  const reducedMotion = useSyncExternalStore(subscribeToMotionPreference, getMotionPreference, getServerMotionPreference);
  const cardRef = useRef<HTMLElement>(null);
  const votesRef = useRef<readonly GenreVote[]>([]);
  const phaseRef = useRef<VotePhase>("idle");
  const motionRef = useRef<CardMotion>(REST_MOTION);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingVoteRef = useRef<GenreVote | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingMotionRef = useRef<CardMotion>(REST_MOTION);

  const changePhase = useCallback((next: VotePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const updateMotion = useCallback((next: CardMotion) => {
    motionRef.current = next;
    setMotion(next);
  }, []);
  const stopFrame = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);
  const releaseGesture = useCallback(() => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    const card = cardRef.current;
    if (gesture && card?.hasPointerCapture(gesture.pointerId)) card.releasePointerCapture(gesture.pointerId);
    stopFrame();
  }, [stopFrame]);

  const restorePreviousGenre = useCallback(() => {
    const previous = votesRef.current.at(-1);
    if (!previous) return;
    changePhase("undo-entering");
    const nextVotes = undoGenreVote(votesRef.current);
    votesRef.current = nextVotes;
    setVotes(nextVotes);
    setLastAction({ type: "undo", genreId: previous.genreId });
    updateMotion(REST_MOTION);
  }, [changePhase, updateMotion]);

  const finishAnimation = useCallback(() => {
    if (phaseRef.current === "exiting") {
      const vote = pendingVoteRef.current;
      if (!vote) return;
      pendingVoteRef.current = null;
      const nextVotes = recordGenreVote(votesRef.current, genres, vote);
      votesRef.current = nextVotes;
      setVotes(nextVotes);
      setLastAction({ type: "vote", vote });
      changePhase(nextVotes.length === genres.length ? "complete" : "entering");
      updateMotion(REST_MOTION);
    } else if (phaseRef.current === "undoing") {
      restorePreviousGenre();
    } else if (phaseRef.current === "returning" || phaseRef.current === "entering" || phaseRef.current === "undo-entering") {
      changePhase("idle");
    }
  }, [genres, changePhase, updateMotion, restorePreviousGenre]);

  useEffect(() => {
    const duration = phase === "returning" ? SWIPE.returnDuration
      : phase === "exiting" ? SWIPE.exitDuration : phase === "undoing" ? SWIPE.undoDuration
        : phase === "entering" || phase === "undo-entering" ? SWIPE.enterDuration : null;
    if (duration === null) return;
    const timer = window.setTimeout(finishAnimation, reducedMotion ? 0 : duration + SWIPE.animationEventGrace);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion, finishAnimation]);

  const cancelGesture = useCallback(() => {
    if (!gestureRef.current) return;
    if (phaseRef.current !== "idle" && phaseRef.current !== "dragging") return;
    releaseGesture();
    if (phaseRef.current === "dragging") {
      changePhase("returning");
      updateMotion(REST_MOTION);
    }
  }, [releaseGesture, changePhase, updateMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") cancelGesture(); };
    const onVisibility = () => { if (document.hidden) cancelGesture(); };
    window.addEventListener("blur", cancelGesture);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", cancelGesture);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      stopFrame();
    };
  }, [cancelGesture, stopFrame]);

  function vote(choice: VoteChoice) {
    if (phaseRef.current !== "idle" && phaseRef.current !== "dragging") return;
    const genre = genres[votesRef.current.length];
    const card = cardRef.current;
    if (!genre || !card) return;
    setCardWidth(card.offsetWidth);
    releaseGesture();
    pendingVoteRef.current = { genreId: genre.id, choice };
    changePhase("exiting");
    const direction = choice === "like" ? 1 : -1;
    updateMotion({
      x: direction * (window.innerWidth + card.offsetWidth + SWIPE.exitMargin),
      y: motionRef.current.y,
      rotation: reducedMotion ? 0 : direction * SWIPE.maxRotationDegrees,
    });
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || phaseRef.current !== "idle" || gestureRef.current) return;
    gestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, axis: "pending" };
    setCardWidth(event.currentTarget.offsetWidth);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function undo() {
    if (votesRef.current.length === 0 || (phaseRef.current !== "idle" && phaseRef.current !== "complete")) return;
    const wasComplete = phaseRef.current === "complete";
    changePhase("undoing");
    releaseGesture();
    pendingVoteRef.current = null;
    updateMotion(REST_MOTION);
    if (wasComplete) restorePreviousGenre();
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const x = event.clientX - gesture.startX;
    const y = event.clientY - gesture.startY;
    if (gesture.axis === "pending") gesture.axis = detectAxis(x, y);
    if (gesture.axis !== "horizontal") return;
    if (event.cancelable) event.preventDefault();
    changePhase("dragging");
    pendingMotionRef.current = dragMotion(x, y, event.currentTarget.offsetWidth, reducedMotion);
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        updateMotion(pendingMotionRef.current);
      });
    }
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const x = event.clientX - gesture.startX;
    const y = event.clientY - gesture.startY;
    const horizontal = gesture.axis === "horizontal";
    releaseGesture();
    if (!horizontal) return;
    if (canCommitSwipe(x, y, event.currentTarget.offsetWidth)) {
      vote(x > 0 ? "like" : "skip");
    } else {
      changePhase("returning");
      updateMotion(REST_MOTION);
    }
  }

  function reset() {
    releaseGesture();
    pendingVoteRef.current = null;
    votesRef.current = [];
    setVotes([]);
    setLastAction(null);
    updateMotion(REST_MOTION);
    changePhase("idle");
  }

  return {
    votes, phase, motion, reducedMotion, cardRef, vote, undo, reset, finishAnimation, lastAction,
    labelOpacity: directionOpacity(motion.x, cardWidth),
    currentGenre: genres[votes.length],
    complete: genres.length > 0 && votes.length === genres.length,
    locked: phase !== "idle",
    canUndo: votes.length > 0 && (phase === "idle" || phase === "complete"),
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancelGesture, onLostPointerCapture: cancelGesture },
  };
}
