import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Matching Meal | 開発環境", description: "Matching Mealの開発環境接続確認" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
