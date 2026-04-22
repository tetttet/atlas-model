"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BotReply } from "@/lib/admissions/types";
import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatSidebar } from "./ChatSidebar";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import {
  initialChat,
  maxStoredChats,
  maxStoredMessages,
  starterChips,
} from "./chat-data";
import {
  readChatHydrationState,
  writeChatHydrationState,
} from "./chat-storage";
import type { ChatSession, ThemeMode } from "./chat-types";
import {
  createEmptyChat,
  createId,
  getDeviceTheme,
  titleFromMessage,
} from "./chat-utils";

type DeleteConfirmation =
  | {
      chatId: string;
      kind: "chat";
      title: string;
    }
  | {
      kind: "all";
    };

export function AdmissionsChat() {
  const [chats, setChats] = useState<ChatSession[]>([initialChat]);
  const [activeChatId, setActiveChatId] = useState(initialChat.id);
  const [input, setInput] = useState("");
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<{ chatId: string; message: string } | null>(
    null,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode | null>(null);
  const [hasThemeOverride, setHasThemeOverride] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeChat = useMemo(() => {
    return (
      chats.find((chat) => chat.id === activeChatId) ?? chats[0] ?? initialChat
    );
  }, [activeChatId, chats]);

  const orderedChats = useMemo(() => {
    return [...chats].sort((first, second) => second.updatedAt - first.updatedAt);
  }, [chats]);

  const isLoading = loadingChatId === activeChat.id;
  const hasAnyLoadingChat = Boolean(loadingChatId);
  const activeError =
    error && error.chatId === activeChat.id ? error.message : "";
  const resolvedTheme = theme ?? "light";
  const deleteConfirmationCopy =
    deleteConfirmation?.kind === "all"
      ? {
          confirmLabel: "Удалить все",
          description:
            "История переписок будет очищена. Это действие нельзя отменить.",
          title: "Удалить все чаты?",
        }
      : {
          confirmLabel: "Удалить чат",
          description: `Чат «${deleteConfirmation?.title ?? "Без названия"}» исчезнет из истории. Это действие нельзя отменить.`,
          title: "Удалить этот чат?",
        };

  const chips = useMemo(() => {
    const lastAssistant = [...activeChat.messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.reply);

    return lastAssistant?.reply?.chips ?? starterChips;
  }, [activeChat.messages]);

  function focusInputOnDesktop() {
    if (window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }

  function closeSidebar() {
    setIsSidebarOpen(false);
    setIsSettingsOpen(false);
  }

  function toggleTheme() {
    setHasThemeOverride(true);
    setTheme((current) => {
      const activeTheme = current ?? getDeviceTheme();
      return activeTheme === "dark" ? "light" : "dark";
    });
  }

  function createNewChat() {
    const chat = createEmptyChat(chats.length);
    setChats((current) => [chat, ...current].slice(0, maxStoredChats));
    setActiveChatId(chat.id);
    setInput("");
    setError(null);
    setTypingMessageId(null);
    setIsSidebarOpen(false);
  }

  function selectChat(chatId: string) {
    setActiveChatId(chatId);
    setInput("");
    setError(null);
    setTypingMessageId(null);
    setIsSidebarOpen(false);
  }

  function requestDeleteChat(chatId: string) {
    const chatToDelete = chats.find((chat) => chat.id === chatId);

    if (!chatToDelete) {
      return;
    }

    setDeleteConfirmation({
      chatId,
      kind: "chat",
      title: chatToDelete.title,
    });
  }

  function deleteChat(chatId: string) {
    const filtered = chats.filter((chat) => chat.id !== chatId);
    const nextChats = filtered.length ? filtered : [createEmptyChat(0)];

    setChats(nextChats);

    if (
      chatId === activeChatId ||
      !nextChats.some((chat) => chat.id === activeChatId)
    ) {
      setActiveChatId(nextChats[0].id);
    }

    if (loadingChatId === chatId) {
      setLoadingChatId(null);
    }

    setTypingMessageId((current) => {
      const deletedChat = chats.find((chat) => chat.id === chatId);
      const deletedMessageIds = new Set(
        deletedChat?.messages.map((message) => message.id) ?? [],
      );

      return current && deletedMessageIds.has(current) ? null : current;
    });

    setError((current) => (current?.chatId === chatId ? null : current));
  }

  function requestClearAllChats() {
    setDeleteConfirmation({ kind: "all" });
  }

  function clearAllChats() {
    const chat = createEmptyChat(0);
    setChats([chat]);
    setActiveChatId(chat.id);
    setInput("");
    setError(null);
    setLoadingChatId(null);
    setTypingMessageId(null);
  }

  function cancelDeleteConfirmation() {
    setDeleteConfirmation(null);
  }

  function confirmDelete() {
    if (!deleteConfirmation) {
      return;
    }

    if (deleteConfirmation.kind === "chat") {
      deleteChat(deleteConfirmation.chatId);
    } else {
      clearAllChats();
    }

    setDeleteConfirmation(null);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeChat.id, activeChat.messages.length, isLoading]);

  useEffect(() => {
    if (!theme) {
      return;
    }

    document.documentElement.dataset.chatTheme = theme;
    document.documentElement.style.colorScheme = theme;

    return () => {
      delete document.documentElement.dataset.chatTheme;
      document.documentElement.style.colorScheme = "";
    };
  }, [theme]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      const stored = readChatHydrationState();
      const storedTheme = stored.theme;

      setTheme(storedTheme ?? getDeviceTheme());
      setHasThemeOverride(Boolean(storedTheme));

      if (stored.chats?.length) {
        setChats(stored.chats);
        setActiveChatId(stored.activeChatId ?? stored.chats[0].id);
      }

      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !isHydrated ||
      hasThemeOverride ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setTheme(getDeviceTheme());

    syncTheme();
    mediaQuery.addEventListener("change", syncTheme);

    return () => mediaQuery.removeEventListener("change", syncTheme);
  }, [hasThemeOverride, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    writeChatHydrationState({
      activeChatId,
      chats,
      theme: hasThemeOverride ? theme : null,
    });
  }, [activeChatId, chats, hasThemeOverride, isHydrated, theme]);

  async function sendMessage(value: string) {
    const text = value.trim();

    if (!text || hasAnyLoadingChat) {
      return;
    }

    const chatId = activeChat.id;
    const memorySnapshot = activeChat.memory;
    const leadProfileSnapshot = activeChat.leadProfile;
    const userMessage = {
      id: createId(),
      role: "user" as const,
      content: text,
    };

    setInput("");
    setError(null);
    setLoadingChatId(chatId);
    setChats((current) =>
      current.map((chat) => {
        if (chat.id !== chatId) {
          return chat;
        }

        const hasUserMessage = chat.messages.some(
          (message) => message.role === "user",
        );

        return {
          ...chat,
          title: hasUserMessage ? chat.title : titleFromMessage(text),
          updatedAt: Date.now(),
          messages: [...chat.messages, userMessage].slice(-maxStoredMessages),
        };
      }),
    );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          memory: memorySnapshot,
          leadProfile: leadProfileSnapshot,
        }),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const reply = (await response.json()) as BotReply;
      const assistantMessage = {
        id: createId(),
        role: "assistant" as const,
        content: reply.answer,
        reply,
      };

      setTypingMessageId(assistantMessage.id);
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                updatedAt: Date.now(),
                memory: reply.memory,
                leadProfile: reply.leadProfile,
                messages: [...chat.messages, assistantMessage].slice(
                  -maxStoredMessages,
                ),
              }
            : chat,
        ),
      );
    } catch {
      setError({
        chatId,
        message: "Не получилось получить ответ. Попробуйте еще раз.",
      });
    } finally {
      setLoadingChatId(null);
      focusInputOnDesktop();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section
      className="chat-shell relative flex h-full min-h-0 w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text)] transition-colors duration-300"
      data-chat-theme={theme ?? undefined}
      style={theme ? { colorScheme: theme } : undefined}
    >
      <ChatSidebar
        activeChatId={activeChat.id}
        chats={orderedChats}
        isOpen={isSidebarOpen}
        isSettingsOpen={isSettingsOpen}
        onClearAllChats={requestClearAllChats}
        onClose={closeSidebar}
        onCloseSettings={() => setIsSettingsOpen(false)}
        onCreateChat={createNewChat}
        onDeleteChat={requestDeleteChat}
        onSelectChat={selectChat}
        onToggleSettings={() => setIsSettingsOpen((current) => !current)}
        onToggleTheme={toggleTheme}
        theme={resolvedTheme}
      />

      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--main-bg)] transition-colors duration-300">
        <ChatHeader
          activeTitle={activeChat.title}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onToggleTheme={toggleTheme}
          theme={resolvedTheme}
        />

        <ChatMessages
          isLoading={isLoading}
          messages={activeChat.messages}
          onTypingComplete={(messageId) =>
            setTypingMessageId((current) =>
              current === messageId ? null : current,
            )
          }
          scrollRef={scrollRef}
          typingMessageId={typingMessageId}
        />

        <ChatComposer
          activeError={activeError}
          chips={chips}
          input={input}
          inputRef={inputRef}
          isDisabled={hasAnyLoadingChat}
          onChangeInput={setInput}
          onChipClick={(chip) => void sendMessage(chip)}
          onSubmit={onSubmit}
          scrollRef={scrollRef}
        />
      </div>

      <DeleteConfirmationDialog
        confirmLabel={deleteConfirmationCopy.confirmLabel}
        description={deleteConfirmationCopy.description}
        isOpen={Boolean(deleteConfirmation)}
        onCancel={cancelDeleteConfirmation}
        onConfirm={confirmDelete}
        title={deleteConfirmationCopy.title}
      />
    </section>
  );
}
