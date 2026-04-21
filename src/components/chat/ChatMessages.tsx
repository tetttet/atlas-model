import type { RefObject } from "react";
import Link from "next/link";
import { productBrand } from "@/lib/admissions/brand";
import { welcomeBackdropSubtext, welcomeBackdropText } from "./chat-data";
import type { ChatMessage } from "./chat-types";

type ChatMessagesProps = {
  isLoading: boolean;
  messages: ChatMessage[];
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function ChatMessages({
  isLoading,
  messages,
  scrollRef,
}: ChatMessagesProps) {
  return (
    <div
      className="relative min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--chat-bg)] px-4 py-5 transition-colors duration-300 sm:px-6"
      ref={scrollRef}
    >
      {messages.length === 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid select-none place-items-center px-6 text-center"
        >
          <div className="space-y-2">
            <p className="text-4xl font-semibold leading-none text-[var(--welcome-backdrop-text)] sm:text-6xl">
              {welcomeBackdropText}
            </p>
            <p className="text-2xl font-medium leading-none text-[var(--welcome-backdrop-text)] sm:text-4xl">
              {welcomeBackdropSubtext}
            </p>
          </div>
        </div>
      ) : null}

      {messages.map((message) => (
        <article
          className={`flex ${
            message.role === "user" ? "justify-end" : "justify-start"
          }`}
          key={message.id}
        >
          <div
            className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm transition-colors duration-300 sm:max-w-[78%] ${
              message.role === "user"
                ? "bg-[var(--user-bubble)] text-[var(--user-bubble-text)]"
                : "border border-[var(--bubble-border)] bg-[var(--assistant-bubble)] text-[var(--assistant-bubble-text)]"
            }`}
          >
            <p className="whitespace-pre-line">{message.content}</p>

            {message.reply?.links?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.reply.links.map((link) => (
                  <Link
                    className="select-none rounded-full bg-[var(--link-chip-bg)] px-3 py-1.5 text-xs font-medium text-[var(--link-chip-text)] transition hover:bg-[var(--link-chip-hover)]"
                    href={link.href}
                    key={link.href}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}

            {message.reply?.actions?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.reply.actions.map((action) => (
                  <Link
                    className="select-none rounded-full bg-[var(--action-bg)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--action-hover)]"
                    href={action.href ?? productBrand.consultationPath}
                    key={`${action.label}-${action.href}`}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </article>
      ))}

      {isLoading ? (
        <div className="flex justify-start">
          <div
            aria-label="Ассистент печатает ответ"
            className="rounded-[22px] border border-[var(--bubble-border)] bg-[var(--assistant-bubble)] px-4 py-3 text-sm text-[var(--muted)] shadow-sm"
            role="status"
          >
            <span
              aria-hidden="true"
              className="flex h-6 items-center gap-1.5"
            >
              <span className="chat-typing-dot block h-2 w-2 rounded-full bg-[var(--muted)]" />
              <span className="chat-typing-dot block h-2 w-2 rounded-full bg-[var(--muted)]" />
              <span className="chat-typing-dot block h-2 w-2 rounded-full bg-[var(--muted)]" />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
