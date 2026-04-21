import { AdmissionsChat } from "@/components/chat/AdmissionsChat";

export default function Home() {
  return (
    <main className="h-[100svh] min-h-[100svh] overflow-hidden bg-[#f7f8f4] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:min-h-[100dvh]">
      <AdmissionsChat />
    </main>
  );
}
