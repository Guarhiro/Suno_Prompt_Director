import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suno Prompt Director",
  description: "Create Suno-ready music direction, style prompts, lyrics, and copy blocks."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
