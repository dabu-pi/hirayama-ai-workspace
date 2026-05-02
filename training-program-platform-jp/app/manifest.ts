import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Training Program JP",
    short_name: "Training",
    description: "日本語対応のスマホ優先トレーニング実行アプリ",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#131d2e",
    background_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
