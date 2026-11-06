import type { MetadataRoute } from "next";
import { APP_ICON_SIZES, APP_PWA } from "./pwa-config";

export function createAppManifest(): MetadataRoute.Manifest {
  return {
    id: APP_PWA.id,
    name: APP_PWA.name,
    short_name: APP_PWA.name,
    description: APP_PWA.description,
    lang: "ja",
    start_url: APP_PWA.startUrl,
    scope: APP_PWA.scope,
    display: "standalone",
    background_color: APP_PWA.backgroundColor,
    theme_color: APP_PWA.themeColor,
    icons: [
      ...APP_ICON_SIZES.map(size => ({ src: `${APP_PWA.iconPath}/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" as const })),
      { src: `${APP_PWA.iconPath}/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
