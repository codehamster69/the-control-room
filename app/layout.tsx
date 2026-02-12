import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Control Room",
  description: "Enter the glitch. Retro anime cyberpunk gaming interface.",
  icons: {
    icon: [
      {
        url: "/favicon-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "The Control Room",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="google-site-verification"
          content="qJbnJhiyCc5QF5TxSAGsdwa2oqLwz86ZVPi0eE_-skE"
        />
        <link href="/favicon.ico" rel="icon" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`font-sans antialiased bg-[#0a0a0a] overflow-hidden h-screen flex items-center justify-center`}
      >
        {/* Phone frame container */}
        <div
          className="relative w-full max-w-md h-[95vh] overflow-hidden"
          style={{
            border: "3px solid transparent",
            borderRadius: "24px",
            boxShadow:
              "0 0 2px rgba(0, 255, 255, 0.15), 0 0 2px rgba(255, 0, 255, 0.1), inset 0 0 2px rgba(0, 255, 255, 0.05)",
            background: "linear-gradient(180deg, #050505 0%, #0a0a0a 40%)",
          }}
        >
          {/* Scrollable content area with custom scrollbar */}
          <div
            className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar"
            style={{ borderRadius: "24px" }}
          >
            {children}
          </div>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
