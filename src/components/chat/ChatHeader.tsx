import Image from "next/image";
import { productBrand } from "@/lib/admissions/brand";
import type { ThemeMode } from "./chat-types";
import { MenuIcon } from "./icons";
import { ThemeSwitch } from "./ThemeSwitch";

type ChatHeaderProps = {
  activeTitle: string;
  onOpenSidebar: () => void;
  onToggleTheme: () => void;
  theme: ThemeMode;
};

export function ChatHeader({
  activeTitle,
  onOpenSidebar,
  onToggleTheme,
  theme,
}: ChatHeaderProps) {
  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--header-bg)] px-3 shadow-[0_1px_0_rgba(20,33,61,0.04)] backdrop-blur transition-colors duration-300 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Открыть sidebar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
          onClick={onOpenSidebar}
          type="button"
        >
          <MenuIcon />
        </button>
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--brand-bg)] shadow-sm">
          <Image
            alt=""
            height={36}
            priority
            src="/atlaspath-mark.svg"
            width={36}
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-[var(--text)]">
            {activeTitle}
          </h1>
          <p className="truncate text-xs text-[var(--muted)]">
            {productBrand.assistantName}
          </p>
        </div>
      </div>
      <ThemeSwitch onToggle={onToggleTheme} theme={theme} />
    </header>
  );
}
