import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import localFont from "next/font/local";
import { TopNav } from "@/widgets/top-nav";
import "./globals.css";

/* Body & long copy — Inter with Cyrillic. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

/* Code editor + tabular data — JetBrains Mono. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

/*
 * Press Start 2P — iconic 8-bit NES pixel font (Google Fonts).
 * Used for all display chrome (brand, panel titles, buttons, badges).
 *
 * PS2P ships Latin + Latin-Ext only — no Cyrillic glyphs. The CSS
 * `--font-display` chain pairs it with Pixellari (local, full Cyrillic) so
 * the browser per-glyph-falls-back: Latin/digits/symbols stay in Press Start
 * 2P, Russian letters drop into Pixellari. End result: cohesive pixel look
 * across both scripts, no synthetic-bold weirdness.
 *
 * Preloaded — it's the brand font, appears above the fold on every page.
 */
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  fallback: ["var(--font-pixellari)", "ui-sans-serif", "system-ui", "sans-serif"],
});

/*
 * Pixellari (local) — Latin + Cyrillic bitmap pixel font, SIL OFL.
 * Sole purpose: provide Cyrillic glyphs behind Press Start 2P so Russian
 * display text doesn't drop to Inter.
 *
 * Source: https://github.com/zedseven/Pixellari, cached at
 * public/fonts/Pixellari.ttf.
 */
const pixellari = localFont({
  src: "../../public/fonts/Pixellari.ttf",
  variable: "--font-pixellari",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d1424",
};

export const metadata: Metadata = {
  title: {
    template: "%s | Sharp Arena",
    default: "Sharp Arena",
  },
  description:
    "Standalone gaming platform for programming challenges. Two modes: Arena (free practice) and Story (narrative progression).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${inter.variable} ${jetbrainsMono.variable} ${pressStart.variable} ${pixellari.variable}`}
    >
      <body className="min-h-screen overflow-x-hidden bg-bg-deep antialiased">
        <TopNav />
        <main className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
