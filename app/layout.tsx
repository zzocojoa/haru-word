import type { Metadata } from "next";
import "./globals.css";
import "./study-design.css";

export const metadata: Metadata = {
  title: "하루단어 · Oxford 3000",
  description: "하루 15분, 헷갈리는 단어부터 내 문장으로. American Oxford 3000 전체 목록으로 배우는 영어.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
