import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { AppNav } from "@/components/navigation/AppNav";

import "./globals.css";

export const metadata: Metadata = {
  title: "Training Program JP",
  description: "日本語対応のスマホ優先トレーニング実行アプリ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Training Program JP"
  },
  icons: {
    apple: "/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#131d2e"
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
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .catch(function(err) { console.warn('SW registration failed:', err); });
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
