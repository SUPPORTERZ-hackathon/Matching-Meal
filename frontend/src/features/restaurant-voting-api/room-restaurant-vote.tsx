"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import { Button } from "@/components/ui/button";
import { GENRES } from "../genre-vote/genres";
import { RestaurantVoteScreen } from "../restaurant-vote/restaurant-vote-screen";
import type { RestaurantVote } from "../restaurant-vote/vote-state";
import type { RoomError, RoomSession } from "../room/room-data";
import { clearRestaurantDraft, loadRestaurantDraft, saveRestaurantDraft } from "./restaurant-draft";
import { submitRestaurantAnswers } from "./restaurant-voting-api";
import type { RestaurantCandidatesSnapshot } from "./restaurant-voting-data";
import styles from "../genre-voting-api/genre-api.module.css";

type RoomRestaurantVoteProps = { session: RoomSession; candidates: RestaurantCandidatesSnapshot; onSaved: () => void; notice?: ReactNode };
export function RoomRestaurantVote({ session, candidates, onSaved, notice }: RoomRestaurantVoteProps) {
  const [initial] = useState(() => loadRestaurantDraft(session, candidates.restaurants));
  const [answers, setAnswers] = useState<readonly RestaurantVote[] | null>(initial.sealed ? initial.votes : null);
  const [sending, setSending] = useState(false), [error, setError] = useState<RoomError | null>(null), [storageWarning, setStorageWarning] = useState(false);
  const locked = useRef(false), disposed = useRef(false), request = useRef<AbortController | null>(null);
  const candidateIds = useMemo(() => candidates.restaurants.map((row) => row.id), [candidates.restaurants]);
  useEffect(() => { disposed.current = false; return () => { disposed.current = true; request.current?.abort(); }; }, []);
  const persist = useCallback((votes: readonly RestaurantVote[]) => {
    if (!saveRestaurantDraft(session, { votes, sealed: false, candidateIds })) setStorageWarning(true);
  }, [session, candidateIds]);
  const send = useCallback(async (votes: readonly RestaurantVote[]) => {
    if (locked.current) return;
    locked.current = true; setSending(true); setError(null); request.current = new AbortController();
    const response = await submitRestaurantAnswers(session, candidates.restaurants, votes, request.current.signal);
    if (disposed.current) return;
    if (response.ok && response.data.submitted) { clearRestaurantDraft(session); onSaved(); return; }
    if (!response.ok) setError(response.error);
    setSending(false); locked.current = false;
  }, [session, candidates.restaurants, onSaved]);
  const complete = useCallback((votes: readonly RestaurantVote[]) => {
    setAnswers(votes);
    if (!saveRestaurantDraft(session, { votes, sealed: true, candidateIds })) setStorageWarning(true);
    void send(votes);
  }, [session, candidateIds, send]);
  const warning = <>{notice}{storageWarning && <p className="meal-flow-notice" role="status">回答はこの画面に保持しています。端末への保存ができないため、送信が完了するまで再読み込みしないでください。</p>}</>;
  const genre = GENRES.find((row) => row.id === candidates.genreId);
  if (!answers) return <RestaurantVoteScreen genre={genre} restaurants={candidates.restaurants} roomId={session.room.joinCode}
    initialVotes={initial.votes} onVotesChange={persist} onComplete={complete} notice={warning} />;
  return <PageContainer className={styles.page} header={<AppHeader roomNumber={session.room.joinCode} />}>
    <StepProgress currentStep="shop" />{warning}
    <section className={styles.content} aria-busy={sending}>
      <h1>{sending ? "店舗投票を保存しています" : "回答を保持しています"}</h1>
      <p role="status">すべての店舗への回答が確定しました。提出後は変更できません。</p>
      {error && <p className={styles.error} role="alert">{error.message} 回答は保持しています。保存状況を確認してから、同じ内容だけを再送します。</p>}
      <Button type="button" variant="primary" size="meal" loading={sending} disabled={sending} onClick={() => { void send(answers); }}>{sending ? "保存中…" : error ? "保存状況を確認して再試行" : "回答を送信する"}</Button>
      <Link href="/home-preview">ホームに戻る</Link>
    </section>
  </PageContainer>;
}
