import type { Config } from "tailwindcss";

// Tailwind 4 reads design tokens from `@theme` in CSS (see src/app/globals.css).
// This file exists only to declare the content glob and any plugin hooks. The
// Sharp Arena palette lives in globals.css under `@theme`.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/widgets/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/entities/**/*.{ts,tsx}",
    "./src/shared/**/*.{ts,tsx}",
  ],
};

export default config;
