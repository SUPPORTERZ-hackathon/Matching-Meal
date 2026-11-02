"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import { Button } from "@/components/ui/button";
import { GENRES } from "../genre-vote/genres";
import { GenreVoteScreen } from "../genre-vote/genre-vote-screen";
import type { GenreVote } from "../genre-vote/vote-state";
import type { RoomError, RoomSession } from "../room/room-data";
import { loadGenreDraft, saveGenreDraft, clearGenreDraft } from "./genre-draft";
import { submitGenreAnswers } from "./genre-voting-api";
import styles from "./genre-api.module.css";

type RoomGenreVoteProps = { session: RoomSession; onSaved: () => void };
export function RoomGenreVote({ session, onSaved }: RoomGenreVoteProps) {
  const [initial] = useState(() => loadGenreDraft(session));
  const [answers, setAnswers] = useState<readonly GenreVote[] | null>(initial.sealed ? initial.votes : null);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<RoomError | null>(null);
  const [storageWarning, setStorageWarning] = useState<boolean>(false);
  const locked = useRef(false), disposed = useRef(false), request = useRef<AbortController | null>(null);
  useEffect(() => { disposed.current = false; return () => { disposed.current = true; request.current?.abort(); }; }, []);
  const persist = useCallback((votes: readonly GenreVote[]) => {
    if (!saveGenreDraft(session, { votes, sealed: false })) setStorageWarning(true);
  }, [session]);
  const send = useCallback(async (votes: readonly GenreVote[]) => {
    if (locked.current) return;
    locked.current = true; setSending(true); setError(null);
    request.current = new AbortController();
    const response = await submitGenreAnswers(session, votes, request.current.signal);
    if (disposed.current) return;
    if (response.ok && response.data.submitted) { clearGenreDraft(session); onSaved(); return; }
    if (!response.ok) setError(response.error);
    setSending(false); locked.current = false;
  }, [session, onSaved]);
  const complete = useCallback((votes: readonly GenreVote[]) => {
    setAnswers(votes);
    if (!saveGenreDraft(session, { votes, sealed: true })) setStorageWarning(true);
    void send(votes);
  }, [session, send]);
  const warning = storageWarning ? <p className="meal-flow-notice" role="status">回答はこの画面に保持しています。端末への保存ができないため、送信が完了するまで再読み込みしないでください。</p> : undefined;
  if (!answers) return <GenreVoteScreen genres={GENRES} roomId={session.room.joinCode} initialVotes={initial.votes} onVotesChange={persist} onComplete={complete} notice={warning} />;
  return <PageContainer className={styles.page} header={<AppHeader roomNumber={session.room.joinCode} />}>
    <StepProgress currentStep="genre" />{warning}
    <section className={styles.content} aria-busy={sending}>
      <h1>{sending ? "投票を保存しています" : "回答を保持しています"}</h1>
      <p role="status">16ジャンルの回答が確定しました。提出後は変更できません。</p>
      {error && <p className={styles.error} role="alert">{error.message} 回答は保持しています。保存状況を再確認してから、同じ内容だけを再送します。</p>}
      <Button type="button" variant="primary" size="meal" loading={sending} disabled={sending} onClick={() => { void send(answers); }}>{sending ? "保存中…" : error ? "保存状況を確認して再試行" : "回答を送信する"}</Button>
      <Link href="/home-preview">ホームに戻る</Link>
    </section>
  </PageContainer>;
}
