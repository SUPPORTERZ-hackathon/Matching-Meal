import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { extname } from "node:path";

// Next.js用の拡張子なしimportを、既存Nodeテスト環境内だけで解決する。
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !extname(specifier) && context.parentURL?.includes("/src/features/")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
