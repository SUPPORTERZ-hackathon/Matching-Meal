"use client";

import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

const LEGACY_VARIANTS: ReadonlyArray<ButtonProps["variant"]> = [
  "default", "destructive", "outline", "secondary", "ghost", "link",
];
const LEGACY_SIZES: ReadonlyArray<ButtonProps["size"]> = ["default", "xs", "sm", "lg"];
const ICON_SIZES: ReadonlyArray<ButtonProps["size"]> = ["icon", "icon-xs", "icon-sm", "icon-lg"];

export function ButtonShowcase() {
  const [clickCount, setClickCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  return (
    <div className="meal-preview-stack">
      <div className="meal-preview-stack">
        <Button variant="primary" size="meal" onClick={() => setClickCount((count) => count + 1)}>
          サンプルを押してみる <ArrowRight className="size-5" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="meal">Outline・枠付き</Button>
        <Button variant="soft" size="meal">Soft・淡い背景</Button>
        <Button variant="dark" size="meal">Dark・濃い背景</Button>
        <p className="meal-preview-caption" role="status">サンプルの押下回数：{clickCount}回</p>
      </div>

      <div className="meal-card meal-preview-stack">
        <h3 className="text-sm font-bold">無効・読み込み中</h3>
        <Button variant="primary" size="meal" disabled>Disabled・操作できません</Button>
        <Button variant="primary" size="meal" loading>読み込み中のサンプル</Button>
        <Button variant="outline" size="meal" disabled>Outline・無効</Button>
        <Button variant="primary" size="meal" loading={loading} onClick={() => setClickCount((count) => count + 1)}>
          {loading ? "状態を確認しています" : "操作できるサンプル"}
        </Button>
        <Button variant="soft" size="meal" aria-pressed={loading} onClick={() => setLoading((value) => !value)}>
          読み込み状態を切り替える
        </Button>
        <p className="meal-preview-caption" role="status">{loading ? "読み込み中：上の操作を無効にしています。" : "通常：上の操作を受け付けます。"}</p>
      </div>

      <details className="meal-card">
        <summary className="cursor-pointer text-sm font-bold focus-visible:outline-2 focus-visible:outline-primary">既存variant・サイズ・asChildを確認</summary>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap gap-2">
            {LEGACY_VARIANTS.map((variant) => <Button key={variant} variant={variant}>{variant}</Button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {LEGACY_SIZES.map((size) => <Button key={size} size={size}>{size}</Button>)}
            {ICON_SIZES.map((size) => <Button key={size} size={size} aria-label={`${size}の見本`}><Plus aria-hidden="true" /></Button>)}
          </div>
          <Button asChild variant="outline" size="meal"><a href="#preview-logo">リンクとして表示する</a></Button>
          <Button asChild variant="outline" size="meal" disabled><a href="#preview-logo" onClick={() => setClickCount((count) => count + 1)}>無効なリンクのサンプル</a></Button>
          <Button asChild variant="outline" size="meal" loading><a href="#preview-logo" onClick={() => setClickCount((count) => count + 1)}>読み込み中のリンク</a></Button>
        </div>
      </details>
    </div>
  );
}
