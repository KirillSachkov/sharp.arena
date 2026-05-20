import type { Metadata } from "next";
import {
  Handjet,
  Jersey_10,
  Jersey_15,
  Jersey_20,
  Jersey_25,
  Major_Mono_Display,
  Pixelify_Sans,
  Press_Start_2P,
  Silkscreen,
  Sixtyfour,
  Tiny5,
  VT323,
  Workbench,
} from "next/font/google";
import { Panel } from "@/shared/ui";

export const metadata: Metadata = {
  title: "Шрифты",
};

const pixelify = Pixelify_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600"],
  preload: false,
  display: "swap",
});

const handjet = Handjet({
  subsets: ["latin", "cyrillic"],
  axes: ["ELGR", "ELSH"],
  preload: false,
  display: "swap",
});

const sixtyfour = Sixtyfour({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
  display: "swap",
});

const jersey10 = Jersey_10({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

const jersey15 = Jersey_15({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

const jersey20 = Jersey_20({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

const jersey25 = Jersey_25({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

const tiny5 = Tiny5({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

const workbench = Workbench({
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

const majorMono = Major_Mono_Display({
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});

type FontSample = {
  name: string;
  className: string;
  cyrillic: boolean;
  weight?: string;
  notes?: string;
};

const FONTS: FontSample[] = [
  {
    name: "Pixelify Sans",
    className: pixelify.className,
    cyrillic: true,
    weight: "400 / 600",
    notes: "Variable weight; \"О\" в кириллице чуть тяжелее.",
  },
  {
    name: "Handjet",
    className: handjet.className,
    cyrillic: true,
    notes: "Dot-matrix variable, узкий по умолчанию.",
  },
  {
    name: "Sixtyfour",
    className: sixtyfour.className,
    cyrillic: false,
    notes: "Scanline pixel, специфичный ретро-CRT стиль. Без кириллицы.",
  },
  {
    name: "Press Start 2P",
    className: pressStart.className,
    cyrillic: false,
    notes: "Иконичный 8-bit NES. Без кириллицы — RU откатится на запасной шрифт.",
  },
  {
    name: "VT323",
    className: vt323.className,
    cyrillic: false,
    notes: "Терминальный пиксельный. Без кириллицы.",
  },
  {
    name: "Silkscreen",
    className: silkscreen.className,
    cyrillic: false,
    weight: "400 / 700",
    notes: "Чистый bitmap, только Latin.",
  },
  {
    name: "Jersey 10",
    className: jersey10.className,
    cyrillic: false,
    notes: "Пиксель-серия (тонкий), Latin only.",
  },
  {
    name: "Jersey 15",
    className: jersey15.className,
    cyrillic: false,
    notes: "Пиксель-серия (средний), Latin only.",
  },
  {
    name: "Jersey 20",
    className: jersey20.className,
    cyrillic: false,
    notes: "Пиксель-серия (плотный), Latin only.",
  },
  {
    name: "Jersey 25",
    className: jersey25.className,
    cyrillic: false,
    notes: "Пиксель-серия (самый плотный), Latin only.",
  },
  {
    name: "Tiny5",
    className: tiny5.className,
    cyrillic: false,
    notes: "Микро 5-pixel bitmap. Latin only.",
  },
  {
    name: "Workbench",
    className: workbench.className,
    cyrillic: false,
    notes: "Variable pixel; Latin only.",
  },
  {
    name: "Major Mono Display",
    className: majorMono.className,
    cyrillic: false,
    notes: "Псевдопиксельный моноширинный. Latin only.",
  },
];

function FontCard({ font }: { font: FontSample }) {
  return (
    <Panel className="space-y-4 p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">{font.name}</h2>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          {font.weight ? <span>weight {font.weight}</span> : null}
          <span
            className={
              font.cyrillic
                ? "rounded-md border border-accent-green/40 bg-accent-green/10 px-1.5 py-0.5 text-accent-green"
                : "rounded-md border border-accent-red/40 bg-accent-red/10 px-1.5 py-0.5 text-accent-red"
            }
          >
            {font.cyrillic ? "RU ✓" : "RU ✗"}
          </span>
        </div>
      </header>

      {/*
       * The global `body .uppercase` rule (0,2,0 specificity) would force
       * font-family to var(--font-display) and override the preview-specific
       * font.className (0,1,0). Apply text-transform via inline style instead
       * so each card renders in its own font.
       */}
      <div
        className={`space-y-3 ${font.className} font-pixel-preview`}
        style={{ fontFamily: undefined }}
      >
        <p
          className="text-[10px] tracking-[0.18em] text-text-muted"
          style={{ textTransform: "uppercase" }}
        >
          АРЕНА · ИСТОРИЯ · РЕЙТИНГ · ПРОФИЛЬ
        </p>
        <p
          className="text-2xl tracking-[0.04em] text-text"
          style={{ textTransform: "uppercase" }}
        >
          АРЕНА · ИСТОРИЯ
        </p>
        <p className="text-base text-text">
          Уровень 24 · Серия 12 дн · Решено 312 · #245
        </p>
        <p className="text-sm text-text-dim">
          LEVEL 24 · STREAK 12 · SOLVED 312 · #245 · +25 XP
        </p>
        <p className="text-sm text-text-dim">
          Войти в арену → Продолжить путь
        </p>
      </div>

      {font.notes ? (
        <p className="text-[11px] text-text-muted">{font.notes}</p>
      ) : null}
    </Panel>
  );
}

export default function FontsPage() {
  const cyrillicFonts = FONTS.filter((f) => f.cyrillic);
  const latinFonts = FONTS.filter((f) => !f.cyrillic);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-pixel text-3xl uppercase tracking-[0.04em] text-text">
          Превью пиксельных шрифтов
        </h1>
        <p className="text-sm text-text-dim">
          Все pixel-style шрифты с Google Fonts. Зелёный значок «RU ✓» — есть
          кириллица. Красный значок «RU ✗» — кириллица недоступна и в этих
          шрифтах русские буквы рендерятся системным запасным.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-pixel text-xl uppercase tracking-[0.08em] text-accent-green">
          С кириллицей
        </h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {cyrillicFonts.map((f) => (
            <FontCard key={f.name} font={f} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-pixel text-xl uppercase tracking-[0.08em] text-accent-red">
          Без кириллицы
        </h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {latinFonts.map((f) => (
            <FontCard key={f.name} font={f} />
          ))}
        </div>
      </section>
    </div>
  );
}
