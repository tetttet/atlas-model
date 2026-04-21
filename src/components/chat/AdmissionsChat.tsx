"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { productBrand } from "@/lib/admissions/brand";
import type {
  BotReply,
  LeadProfile,
  StudentMemory,
} from "@/lib/admissions/types";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  reply?: BotReply;
};

const starterChips = [
  "Какие документы нужны?",
  "В какую страну лучше поступать?",
  "Нужен ли IELTS?",
  "Я хочу начать поступление",
];

const storageKey = productBrand.storageKey;
const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: `Здравствуйте. Я ${productBrand.assistantName}. Помогу быстро разобраться со странами, документами, IELTS, дедлайнами, стоимостью и следующим шагом.`,
};

type StoredChatState = {
  messages: ChatMessage[];
  memory: StudentMemory;
  leadProfile: LeadProfile;
};

function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h13m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function AdmissionsChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [memory, setMemory] = useState<StudentMemory>({});
  const [leadProfile, setLeadProfile] = useState<LeadProfile>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function focusInputOnDesktop() {
    if (window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }

  const chips = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.reply);

    return lastAssistant?.reply?.chips ?? starterChips;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      try {
        const raw = localStorage.getItem(storageKey);

        if (!raw) {
          setIsHydrated(true);
          return;
        }

        const stored = JSON.parse(raw) as Partial<StoredChatState>;

        if (Array.isArray(stored.messages) && stored.messages.length > 0) {
          setMessages(stored.messages.slice(-40));
        }

        if (stored.memory && typeof stored.memory === "object") {
          setMemory(stored.memory);
        }

        if (stored.leadProfile && typeof stored.leadProfile === "object") {
          setLeadProfile(stored.leadProfile);
        }
      } catch {
        localStorage.removeItem(storageKey);
      } finally {
        setIsHydrated(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const stored: StoredChatState = {
      messages: messages.slice(-40),
      memory,
      leadProfile,
    };

    localStorage.setItem(storageKey, JSON.stringify(stored));
  }, [isHydrated, leadProfile, memory, messages]);

  async function sendMessage(value: string) {
    const text = value.trim();

    if (!text || isLoading) {
      return;
    }

    setInput("");
    setError("");
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          memory,
          leadProfile,
        }),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const reply = (await response.json()) as BotReply;
      setMemory(reply.memory);
      setLeadProfile(reply.leadProfile);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: reply.answer,
          reply,
        },
      ]);
    } catch {
      setError("Не получилось получить ответ. Попробуйте еще раз.");
    } finally {
      setIsLoading(false);
      focusInputOnDesktop();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function resetChat() {
    localStorage.removeItem(storageKey);
    setMessages([welcomeMessage]);
    setMemory({});
    setLeadProfile({});
    setError("");
  }

  return (
    <section className="flex h-full min-h-0 w-full overflow-hidden bg-[#f7f9f6]">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
        <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#dfe6dd] bg-white/95 px-4 shadow-[0_1px_0_rgba(20,33,61,0.04)] backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#0f766e] shadow-sm">
              <Image
                alt=""
                height={40}
                priority
                src="/atlaspath-mark.svg"
                width={40}
              />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-[#14213d]">
                {productBrand.assistantName}
              </h1>
              <p className="truncate text-xs text-[#5f6f68]">
                онлайн-консультант
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className="select-none rounded-full border border-[#cfdad0] px-3 py-2 text-xs font-medium text-[#14213d] transition hover:border-[#0f766e] hover:text-[#0f766e]"
              href={productBrand.consultationPath}
            >
              Консультация
            </Link>
            <button
              aria-label="Очистить диалог"
              className="grid h-9 w-9 select-none place-items-center rounded-full border border-[#cfdad0] text-[#5f6f68] transition hover:border-[#0f766e] hover:text-[#0f766e]"
              onClick={resetChat}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f7f9f6] px-4 py-5 sm:px-6"
        >
          {messages.map((message) => (
            <article
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
              key={message.id}
            >
              <div
                className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 sm:max-w-[78%] ${
                  message.role === "user"
                    ? "bg-[#14213d] text-white"
                    : "border border-[#dfe6dd] bg-white text-[#1c2b2a]"
                }`}
              >
                <p className="whitespace-pre-line">{message.content}</p>

                {message.reply?.links.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.reply.links.map((link) => (
                      <Link
                        className="select-none rounded-full bg-[#edf7f4] px-3 py-1.5 text-xs font-medium text-[#0f766e] transition hover:bg-[#d9f0ea]"
                        href={link.href}
                        key={link.href}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}

                {message.reply?.actions.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.reply.actions.map((action) => (
                      <Link
                        className="select-none rounded-full bg-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1d4ed8]"
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
              <div className="rounded-[22px] border border-[#dfe6dd] bg-white px-4 py-3 text-sm text-[#5f6f68]">
                Думаю...
              </div>
            </div>
          ) : null}
        </div>

        <footer className="relative z-10 shrink-0 border-t border-[#dfe6dd] bg-white px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 sm:px-5">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {chips.map((chip) => (
              <button
                className="shrink-0 select-none rounded-full border border-[#dfe6dd] px-3 py-2 text-xs font-medium text-[#31413e] transition hover:border-[#0f766e] hover:text-[#0f766e] disabled:opacity-50"
                disabled={isLoading}
                key={chip}
                onClick={() => void sendMessage(chip)}
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
              className="min-h-12 flex-1 rounded-2xl border border-[#cfdad0] bg-[#fbfcfb] px-4 py-3 text-base text-[#14213d] outline-none transition placeholder:text-[#81908a] focus:border-[#0f766e] focus:bg-white focus:ring-4 focus:ring-[#0f766e]/10 sm:text-sm"
              disabled={isLoading}
              enterKeyHint="send"
              id="chat-input"
              inputMode="text"
              maxLength={1200}
              onChange={(event) => setInput(event.target.value)}
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
              className="grid h-12 w-12 shrink-0 select-none place-items-center rounded-2xl bg-[#0f766e] text-white transition hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:bg-[#93aaa4]"
              disabled={isLoading || !input.trim()}
              type="submit"
            >
              <SendIcon />
            </button>
          </form>

          {error ? (
            <p className="mt-2 text-xs text-[#b8452f]" role="alert">
              {error}
            </p>
          ) : null}
        </footer>
      </div>
    </section>
  );
}
