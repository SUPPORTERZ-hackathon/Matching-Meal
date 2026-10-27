import type { Metadata } from "next";
import { ArrowLeft, ArrowUp, CircleAlert, CircleDashed, Users } from "lucide-react";
import { AppLogo } from "@/components/common/app-logo";
import { AppHeader } from "@/components/common/app-header";
import { BottomAction } from "@/components/common/bottom-action";
import { PageContainer } from "@/components/common/page-container";
import { ParticipantAvatar, type ParticipantAvatarProps } from "@/components/common/participant-avatar";
import { MEAL_STEPS, StepProgress } from "@/components/common/step-progress";
import { Button } from "@/components/ui/button";
import { ButtonShowcase } from "./button-showcase";

export const metadata: Metadata = {
  title: "共通UIプレビュー | メシマッチ",
  description: "メシマッチの共通UIをサンプルデータで確認できます。",
};

const PREVIEW_ROOM = "2481";
const PREVIEW_PARTICIPANTS: ReadonlyArray<ParticipantAvatarProps> = [
  { nickname: "ゆうき", avatarText: "YU", state: "complete", size: "lg" },
  { nickname: "みさき", avatarText: "MI", tone: "pink", state: "complete", size: "lg" },
  { nickname: "けんた", avatarText: "KE", tone: "blue", state: "waiting", size: "lg" },
  { nickname: "とても長いニックネームでも最後まで表示できる参加者さん", tone: "pink" },
  { nickname: "VeryLongParticipantNameWithoutSpacesForLayoutPreview", tone: "blue" },
  { nickname: "" },
];

export default function UiPreviewPage() {
  return (
    <div className="meal-preview-background">
      <PageContainer
        header={<AppHeader roomNumber={PREVIEW_ROOM} />}
        bottomAction={
          <BottomAction note="表示確認用のサンプルです。下部操作も本文に続けて配置し、長い内容や小さな画面でも重ならないようにしています。">
            <Button asChild variant="primary" size="meal">
              <a href="#preview-logo">ページ上部のロゴへ <ArrowUp className="size-5" aria-hidden="true" /></a>
            </Button>
          </BottomAction>
        }
      >
        <div className="mb-6">
          <p className="mb-2 text-[11px] font-extrabold tracking-[.12em] text-primary">UI PREVIEW</p>
          <h1 className="mb-2 text-[28px] leading-snug tracking-[-.04em]">メシマッチの共通UI</h1>
          <p className="text-sm leading-[1.8] text-muted-foreground">みんなで選ぶ、今日のごはん。<br />色や文字、部品の状態をここで確認できます。</p>
          <p className="meal-preview-caption mt-3">すべて表示確認用のサンプルです。</p>
        </div>

        <section id="preview-logo" className="meal-preview-section" aria-labelledby="logo-heading">
          <h2 id="logo-heading">01　ロゴ</h2>
          <div className="meal-card meal-preview-stack">
            <AppLogo />
            <AppLogo compact />
            <p className="meal-preview-caption">通常サイズ / コンパクトサイズ</p>
          </div>
        </section>

        <section className="meal-preview-section" aria-labelledby="header-heading">
          <h2 id="header-heading">02　共通ヘッダー</h2>
          <p className="meal-preview-caption">ルーム番号ありはページ先頭に表示しています。</p>
          <div className="meal-preview-header">
            <AppHeader />
            <AppHeader layout="centered" leading={
              <Button asChild variant="outline" size="icon-lg" className="rounded-[13px]">
                <a href="#preview-logo" aria-label="戻る見本：ロゴへ"><ArrowLeft className="size-5" aria-hidden="true" /></a>
              </Button>
            } />
            <AppHeader roomNumber="long-room-number-for-responsive-layout-preview" />
          </div>
          <p className="meal-preview-caption mt-3">ルーム番号なし / 中央配置 / 長いルーム番号</p>
        </section>

        <section className="meal-preview-section" aria-labelledby="steps-heading">
          <h2 id="steps-heading">03　4段階の進捗</h2>
          <div className="meal-preview-stack">
            {MEAL_STEPS.map((step) => (
              <div key={step.id}>
                <p className="meal-preview-caption">現在：{step.label}</p>
                <StepProgress currentStep={step.id} />
              </div>
            ))}
          </div>
        </section>

        <section className="meal-preview-section" aria-labelledby="buttons-heading">
          <h2 id="buttons-heading">04　ボタン</h2>
          <ButtonShowcase />
        </section>

        <section className="meal-preview-section" aria-labelledby="cards-heading">
          <h2 id="cards-heading">05　カード・表示状態</h2>
          <div className="meal-preview-stack">
            <div className="meal-card">
              <p className="mb-2 text-sm font-bold">今日のごはんを、みんなで。</p>
              <p className="meal-preview-caption">白い背景、やわらかな影、22pxの角丸。画面をまたいで使える、基本のカードです。</p>
            </div>
            <div className="meal-card flex items-center gap-3">
              <CircleDashed className="size-5 shrink-0 text-primary motion-safe:animate-spin" aria-hidden="true" />
              <p className="meal-preview-caption">読み込み中の表示サンプル</p>
            </div>
            <div className="meal-card text-center">
              <Users className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm">まだ参加者がいません</p>
              <p className="meal-preview-caption mt-2">空の状態の表示サンプル</p>
            </div>
            <div className="meal-card">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-primary-dark"><CircleAlert className="size-5 shrink-0" aria-hidden="true" />表示できませんでした</p>
              <p className="meal-preview-caption">エラー時の表示サンプルです。実際の通信は行っていません。</p>
            </div>
          </div>
        </section>

        <section className="meal-preview-section" aria-labelledby="participants-heading">
          <h2 id="participants-heading">06　参加者アバター</h2>
          <div className="meal-card meal-preview-stack">
            {PREVIEW_PARTICIPANTS.map((participant, index) => <ParticipantAvatar key={index} {...participant} />)}
          </div>
        </section>

        <section className="meal-preview-section" aria-labelledby="bottom-heading">
          <h2 id="bottom-heading">07　下部操作領域</h2>
          <p className="meal-preview-caption">本文のあとにボタンと補足を配置します。長いページは通常のページスクロールで確認できます。</p>
        </section>
      </PageContainer>
    </div>
  );
}
