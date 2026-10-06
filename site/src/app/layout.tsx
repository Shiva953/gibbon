import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { KeyNav, StatusLine, TopBar } from "@/components/shell";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const title = "Gibbon — Bounties as code for Gibwork";
const description =
  "Keep your Gibwork bounty backlog in one YAML file, preview every change, and never pay twice.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#0e0d0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jetbrains.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <TopBar />
        {children}
        <StatusLine />
        <KeyNav />
      </body>
    </html>
  );
}
