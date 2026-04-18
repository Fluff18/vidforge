import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidForge — AI Video Generation Framework",
  description: "Generate, score, and iterate on AI videos in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
