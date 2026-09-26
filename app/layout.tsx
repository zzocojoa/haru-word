import type { Metadata, Viewport } from "next";
import { WebFonts } from './web-fonts';
import { startupImages } from '@/lib/startup-images';
import "./globals.css";
import "./study-design.css";
import './grammar.css';
import './startup-screen.css';

export const metadata: Metadata = {
  title: "하루단어 · Oxford 3000",
  description: "하루 15분, 헷갈리는 단어부터 내 문장으로. American Oxford 3000 전체 목록으로 배우는 영어.",
  appleWebApp: {
    capable: true,
    title: '하루단어',
    statusBarStyle: 'default',
    startupImage: startupImages.map(({ url, media }) => ({ url, media })),
  },
  // Vinext emits mobile-web-app-capable for appleWebApp; retain legacy iOS support.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
  },
};

export const viewport: Viewport = { themeColor: '#ffffff' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* The private Site requires credentials even for its same-origin manifest. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body className="antialiased"><WebFonts />{children}</body>
    </html>
  );
}
