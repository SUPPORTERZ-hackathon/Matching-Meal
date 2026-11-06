import type { MetadataRoute } from "next";
import { createAppManifest } from "@/features/pwa/pwa-manifest";

export default function manifest(): MetadataRoute.Manifest {
  return createAppManifest();
}
