import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { ParticipantAvatar } from "@/components/common/participant-avatar";
import { StepProgress, type MealStep } from "@/components/common/step-progress";
import { summarizeParticipants, type WaitingParticipant } from "./waiting-state";
import { VoteCompletionMark } from "./vote-completion-mark";
import styles from "./genre-vote-waiting.module.css";

export type GenreVoteWaitingScreenProps = {
  participants: readonly WaitingParticipant[];
  roomId?: string;
  currentStep?: MealStep;
  voteSubject?: "ジャンル" | "店舗";
};

export function GenreVoteWaitingScreen({ participants, roomId, currentStep = "genre", voteSubject = "ジャンル" }: GenreVoteWaitingScreenProps) {
  const headingId = `${currentStep}-waiting-heading`;
  const statusId = `${currentStep}-waiting-status`;
  const { total, completed, remaining, percentage, allComplete } = summarizeParticipants(participants);
  const remainingLabel = total === 0 ? "確認待ち" : allComplete ? "全員完了" : `あと${remaining}人`;
  const announcement = total === 0 ? "参加者情報がありません。"
    : `${total}人中${completed}人が投票完了。${remainingLabel}。${allComplete ? "投票結果の受信を待っています。" : "みんなの投票を待っています。"}`;

  return (
    <div className={styles.background}>
      <PageContainer className={styles.page} header={<AppHeader roomNumber={roomId} className={styles.header} />}>
        <StepProgress currentStep={currentStep} />
        <div className={styles.content}>
          <section className={styles.hero} aria-labelledby={headingId}>
            <VoteCompletionMark />
            <p className={styles.kicker}>投票完了！</p>
            <h1 id={headingId}>
              <span>みんなの投票{allComplete ? "が" : "を"}</span>
              <span>{allComplete ? "完了しました" : "待っています"}</span>
            </h1>
            <p className={styles.description}>
              {allComplete ? "全員の投票が完了しました。投票結果の受信を待っています。" : "全員が投票すると、自動で結果が表示されます。"}
            </p>
          </section>

          <section className={`meal-card ${styles.statusCard}`} aria-labelledby={statusId}>
            <h2 id={statusId} className="sr-only">投票状況</h2>
            <div className={styles.statusCount}>
              <p className={styles.count}><strong>{completed}</strong><span>/ {total}人</span></p>
              <p className={styles.remaining}>{remainingLabel}</p>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label={`参加者の${voteSubject}投票完了状況`}
              aria-valuemin={0}
              aria-valuemax={total || 1}
              aria-valuenow={completed}
              aria-valuetext={total === 0 ? "参加者情報なし" : `${total}人中${completed}人が完了、${remainingLabel}`}
            >
              <span style={{ width: `${percentage}%` }} />
            </div>
            {total === 0 ? <p className={styles.empty}>参加者情報がありません</p> : (
              <ul className={styles.participants} aria-label="参加者の投票状況">
                {participants.map((participant) => (
                  <li key={participant.id} data-participant-id={participant.id}>
                    <ParticipantAvatar nickname={participant.nickname} avatarText={participant.avatarText} tone={participant.tone} state={participant.state} size="lg" className={styles.participant} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
        </div>
      </PageContainer>
    </div>
  );
}
