import type { Metadata } from "next";
import { Space_Grotesk, Bebas_Neue, JetBrains_Mono, Cinzel } from "next/font/google";
import "./globals.css";

// Body — Space Grotesk. Warm, slightly quirky geometric sans that carries the
// Mamdani-campaign Neue-Haas-Grotesk feel with a friendlier vibe.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-body-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Display — Bebas Neue. Tall, bold, condensed caps — the Zohran-for-NYC
// poster headline look.
const bebas = Bebas_Neue({
  variable: "--font-poster",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vantage — Ask Earth anything.",
  description:
    "A chat-first interface to Earth observation. Every answer cited. Every claim verified.",
  metadataBase: new URL("https://vantage.app"),
  openGraph: {
    title: "Vantage",
    description:
      "A chat-first interface to Earth observation. Every answer cited.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${bebas.variable} ${jetbrainsMono.variable} ${cinzel.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
