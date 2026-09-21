import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "하루단어 · Oxford 3000",
  description: "하루 15분, 헷갈리는 단어부터 내 문장으로. American Oxford 3000 전체 목록으로 배우는 영어.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
