import type { Metadata } from "next";

import { AppNav } from "@/components/navigation/AppNav";

import "./globals.css";

export const metadata: Metadata = {
  title: "Training Program Platform JP",
  description:
    "スマホ優先のトレーニング実行 Web アプリ骨組み。Next.js + Supabase 方針で本実装へ移行するための土台。"
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body>
        {children}
        <AppNav />
      </body>
    </html>
  );
}
