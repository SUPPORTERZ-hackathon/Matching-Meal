import type { ReactNode } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/common/page-container";
import { AppHeader } from "@/components/common/app-header";
import { StepProgress, type MealStep } from "@/components/common/step-progress";

export function DevelopmentDemoNotice() {
  return <aside className="meal-flow-notice" role="note" data-development-demo>開発用デモ · 表示は既存のモックです。投票の保存・同期・集計は行いません。</aside>;
}

type FlowMessageProps = { title: string; description: string; step: MealStep; roomNumber?: string; bottomAction?: ReactNode };
export function FlowMessage({ title, description, step, roomNumber, bottomAction }: FlowMessageProps) {
  return <PageContainer className="meal-flow-page" header={<AppHeader roomNumber={roomNumber} />} bottomAction={bottomAction}>
    <StepProgress currentStep={step} />
    <section className="meal-flow-message" role="status"><h1>{title}</h1><p>{description}</p><Link href="/home-preview">ホームに戻る</Link></section>
  </PageContainer>;
}
