import "../genre-voting-api/test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const { APP_APPLE_ICON_SIZE, APP_FAVICON_SIZE, APP_PWA } = await import("./pwa-config.ts");
const { createAppManifest } = await import("./pwa-manifest.ts");

const publicFile = path => fileURLToPath(new URL(`../../../public${path}`, import.meta.url));
const routes = ["/home-preview", "/room-create", "/room-waiting", "/qr-scan", "/j/7K9M2QXR", "/genre-vote", "/genre-vote-waiting", "/genre-result", "/restaurant-vote", "/restaurant-vote-waiting", "/restaurant-result"];

test("ホームから起動し、全12画面を同じscopeと既存アプリIDに含める", async () => {
  const manifest = createAppManifest();
  assert.equal(manifest.start_url, "/home-preview");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.id, "/genre-vote"); // インストール済みアプリの識別子を変更しない。
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.name, "メシマッチ");
  assert.equal(manifest.short_name, "メシマッチ");
  assert.equal(manifest.lang, "ja");
  assert.equal(manifest.theme_color, "#ED3B33");
  assert.equal(manifest.background_color, "#FFFDFA");
  const start = new URL(manifest.start_url, "https://example.com");
  assert.equal(start.search, "");
  assert.equal(start.hash, "");
  for (const path of routes) {
    assert(new URL(path, start).href.startsWith(new URL(manifest.scope, start).href));
    const route = path.startsWith("/j/") ? "/j/[joinCode]" : path;
    await access(new URL(`../../app${route}/page.tsx`, import.meta.url));
  }
});

test("manifestの192/512px画像は実在する正しい寸法のPNG", async () => {
  const icons = createAppManifest().icons;
  assert.deepEqual(icons.filter(icon => icon.purpose === "any").map(icon => icon.sizes), ["192x192", "512x512"]);
  for (const icon of icons) {
    assert.equal(icon.type, "image/png");
    const image = await sharp(publicFile(icon.src)).metadata();
    assert.equal(image.format, "png");
    assert.equal(`${image.width}x${image.height}`, icon.sizes);
  }
});

test("maskableは全面不透明で、白いMが中央の安全円に収まる", async () => {
  const icon = createAppManifest().icons.find(icon => icon.purpose === "maskable");
  assert(icon);
  const { data, info } = await sharp(publicFile(icon.src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512); assert.equal(info.height, 512);
  assert.deepEqual([...data.subarray(0, 4)], [237, 59, 51, 255]);
  const radius = info.width * 0.4;
  let whitePixels = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const offset = (y * info.width + x) * info.channels;
    assert.equal(data[offset + 3], 255);
    if (data[offset] > 230 && data[offset + 1] > 230 && data[offset + 2] > 230) {
      whitePixels++;
      assert(Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) <= radius);
    }
  }
  assert(whitePixels > 0);
});

test("共通Appleアイコンとfaviconは有効なPNGでApple用は透過しない", async () => {
  const apple = await sharp(publicFile(`${APP_PWA.iconPath}/apple-180.png`)).metadata();
  assert.equal(apple.format, "png");
  assert.equal(apple.width, APP_APPLE_ICON_SIZE); assert.equal(apple.height, APP_APPLE_ICON_SIZE);
  assert.equal(apple.hasAlpha, false);
  const favicon = await sharp(publicFile(`${APP_PWA.iconPath}/favicon-32.png`)).metadata();
  assert.equal(favicon.format, "png");
  assert.equal(favicon.width, APP_FAVICON_SIZE); assert.equal(favicon.height, APP_FAVICON_SIZE);
});
