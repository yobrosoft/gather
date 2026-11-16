import type { Metadata } from "next";
import { Outfit, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif" });

export const metadata: Metadata = {
  title: "Gather",
  description: "See cinema viewings you can attend, and help your church book one.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${sourceSerif.variable}`}>{children}</body>
    </html>
  );
}
