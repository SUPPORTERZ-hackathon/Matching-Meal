import { createGenreManifest } from "@/features/genre-vote/pwa-manifest";

export const dynamic = "force-static";

export function GET() {
  return Response.json(createGenreManifest(), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
