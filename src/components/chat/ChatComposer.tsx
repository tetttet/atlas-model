import type { FormEvent, RefObject } from "react";
import { SendIcon } from "./icons";

type ChatComposerProps = {
  activeError: string;
  chips: string[];
  input: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isDisabled: boolean;
  onChangeInput: (value: string) => void;
  onChipClick: (chip: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function ChatComposer({
  activeError,
  chips,
  input,
  inputRef,
  isDisabled,
  onChangeInput,
  onChipClick,
  onSubmit,
  scrollRef,
}: ChatComposerProps) {
  return (
    <footer className="relative z-10 shrink-0 border-t border-[var(--border)] bg-[var(--chat-bg)] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 transition-colors duration-300 sm:px-5">
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <button
            className="shrink-0 select-none rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-medium text-[var(--chip-text)] shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--chip-hover-bg)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDisabled}
            key={chip}
            onClick={() => onChipClick(chip)}
            type="button"
          >
            {chip}
          </button>
        ))}
      </div>

      <form className="flex items-end gap-2" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="chat-input">
          Вопрос о поступлении
        </label>
        <input
          autoComplete="off"
          autoCorrect="on"
          className="min-h-12 flex-1 rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-base text-[var(--text)] outline-none transition placeholder:text-[var(--placeholder)] focus:border-[var(--accent)] focus:bg-[var(--input-focus-bg)] focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          disabled={isDisabled}
          enterKeyHint="send"
          id="chat-input"
          inputMode="text"
          maxLength={1200}
          onChange={(event) => onChangeInput(event.target.value)}
          onFocus={() => {
            window.setTimeout(() => {
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth",
              });
            }, 250);
          }}
          placeholder="Напишите вопрос о поступлении..."
          ref={inputRef}
          value={input}
        />
        <button
          aria-label="Отправить"
          className="grid h-12 w-12 shrink-0 select-none place-items-center rounded-2xl bg-[var(--send-bg)] text-white transition hover:bg-[var(--send-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--send-disabled)]"
          disabled={isDisabled || !input.trim()}
          type="submit"
        >
          <SendIcon />
        </button>
      </form>

      {activeError ? (
        <p className="mt-2 text-xs text-[var(--danger)]" role="alert">
          {activeError}
        </p>
      ) : null}
    </footer>
  );
}
