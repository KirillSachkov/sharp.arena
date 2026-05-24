import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "История",
};

export default function StoryLayout({ children }: { children: ReactNode }) {
  return children;
}
