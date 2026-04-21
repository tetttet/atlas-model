import type { ThemeMode } from "./chat-types";
import { MoonIcon, SunIcon } from "./icons";

type ThemeSwitchProps = {
  onToggle: () => void;
  theme: ThemeMode;
};

export function ThemeSwitch({ onToggle, theme }: ThemeSwitchProps) {
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Включить светлую тему" : "Включить темную тему"}
      aria-pressed={isDark}
      className="relative inline-flex h-10 w-[76px] shrink-0 rounded-full border border-[var(--switch-border)] bg-[var(--switch-bg)] p-1 text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-300 hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
      onClick={onToggle}
      type="button"
    >
      <span
        className={`absolute left-1 top-1 h-8 w-8 rounded-full bg-[var(--switch-knob)] shadow-sm transition-transform duration-300 ease-out ${
          isDark ? "translate-x-9" : "translate-x-0"
        }`}
      />
      <span
        className={`absolute left-1 top-1 z-10 grid h-8 w-8 place-items-center transition-colors duration-300 ${
          isDark
            ? "text-[var(--switch-inactive-icon)]"
            : "text-[var(--switch-active-icon)]"
        }`}
      >
        <SunIcon />
      </span>
      <span
        className={`absolute right-1 top-1 z-10 grid h-8 w-8 place-items-center transition-colors duration-300 ${
          isDark
            ? "text-[var(--switch-active-icon)]"
            : "text-[var(--switch-inactive-icon)]"
        }`}
      >
        <MoonIcon />
      </span>
    </button>
  );
}
