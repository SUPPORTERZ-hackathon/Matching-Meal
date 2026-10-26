"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
type Status = "checking" | "ok" | "error";
async function probe(): Promise<Status> {
  try {
    const response = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    return response.ok && data.status === "ok" && data.database === "ok" ? "ok" : "error";
  } catch { return "error"; }
}
export default function Home() {
  const [status, setStatus] = useState<Status>("checking");
  async function check() {
    setStatus("checking");
    setStatus(await probe());
  }
  useEffect(() => {
    let active = true;
    void probe().then(result => { if (active) setStatus(result); });
    return () => { active = false; };
  }, []);
  return <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
    <p className="mb-4 text-sm font-semibold tracking-widest text-green-800">MATCHING MEAL</p>
    <h1 className="text-3xl font-bold sm:text-4xl">みんなで選ぶ、今日のごはん。</h1>
    <p className="mt-4 text-stone-600">開発環境の準備状況を確認できます。</p>
    <section className="mt-10 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm" aria-labelledby="status-heading">
      <h2 id="status-heading" className="text-lg font-semibold">接続ステータス</h2>
      <p role="status" aria-live="polite" className="my-5 leading-7">
        {status === "checking" ? "API・データベースに接続しています…" : status === "ok" ? "接続成功：画面 → Go API → PostgreSQL が動作しています。" : "接続できませんでした。Dockerの起動状態とログを確認してください。"}
      </p>
      <Button onClick={() => void check()} disabled={status === "checking"}>再確認する</Button>
    </section>
    <p className="mt-6 text-sm leading-6 text-stone-500">店舗検索・ルーム作成・投票機能は、これから実装します。</p>
  </main>;
}
