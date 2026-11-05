import { APP_PWA } from "@/features/pwa/pwa-config";

export const dynamic = "force-static";

export function GET() {
  // 旧URLで更新を確認する既存インストールにも、同じIDの共通設定を返す。
  return new Response(null, { status: 308, headers: { Location: APP_PWA.manifestPath } });
}
