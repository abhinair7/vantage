import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Typography: on macOS/iOS the browser will resolve `-apple-system` →
 * SF Pro Display/Text automatically; Inter is the cross-platform fallback
 * closest to SF's metrics so the display type doesn't shift on Windows/Linux.
 */
const inter = Inter({
  variable: "--font-sf",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
