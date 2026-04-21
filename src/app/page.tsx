import type { Metadata } from "next";
import { AdmissionsChat } from "@/components/chat/AdmissionsChat";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <main className="h-[100svh] min-h-[100svh] overflow-hidden bg-[var(--app-bg)] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:min-h-[100dvh]">
      <AdmissionsChat />
    </main>
  );
}
