import {
  initialChat,
  maxStoredChats,
  maxStoredMessages,
  storageKey,
  themeOverrideStorageKey,
  themeStorageKey,
  threadsStorageKey,
} from "./chat-data";
import type {
  ChatSession,
  StoredChatState,
  StoredThreadState,
  ThemeMode,
} from "./chat-types";
import {
  createId,
  isChatMessage,
  isThemeMode,
  normalizeChat,
  removeLegacyWelcomeMessages,
  titleFromMessages,
} from "./chat-utils";

type ChatHydrationState = {
  activeChatId: string | null;
  chats: ChatSession[] | null;
  theme: ThemeMode | null;
};

export function readChatHydrationState(): ChatHydrationState {
  let theme: ThemeMode | null = null;

  try {
    const hasStoredThemeOverride =
      localStorage.getItem(themeOverrideStorageKey) === "true";
    const storedTheme = localStorage.getItem(themeStorageKey);

    if (hasStoredThemeOverride && isThemeMode(storedTheme)) {
      theme = storedTheme;
    }

    const rawThreads = localStorage.getItem(threadsStorageKey);

    if (rawThreads) {
      const stored = JSON.parse(rawThreads) as Partial<StoredThreadState>;
      const chats = Array.isArray(stored.chats)
        ? stored.chats
            .map((chat, index) => normalizeChat(chat, index))
            .filter((chat): chat is ChatSession => Boolean(chat))
            .slice(0, maxStoredChats)
        : [];

      return {
        activeChatId:
          typeof stored.activeChatId === "string" &&
          chats.some((chat) => chat.id === stored.activeChatId)
            ? stored.activeChatId
            : chats[0]?.id ?? null,
        chats: chats.length ? chats : null,
        theme:
          hasStoredThemeOverride && isThemeMode(stored.theme)
            ? stored.theme
            : theme,
      };
    }

    const rawLegacyChat = localStorage.getItem(storageKey);

    if (rawLegacyChat) {
      const stored = JSON.parse(rawLegacyChat) as Partial<StoredChatState>;
      const messages = Array.isArray(stored.messages)
        ? removeLegacyWelcomeMessages(stored.messages.filter(isChatMessage)).slice(
            -maxStoredMessages,
          )
        : [];

      if (messages.length) {
        const now = Date.now();
        const migratedChat: ChatSession = {
          id: createId(),
          title: titleFromMessages(messages),
          createdAt: now,
          updatedAt: now,
          messages,
          memory:
            stored.memory && typeof stored.memory === "object"
              ? stored.memory
              : {},
          leadProfile:
            stored.leadProfile && typeof stored.leadProfile === "object"
              ? stored.leadProfile
              : {},
        };

        localStorage.removeItem(storageKey);

        return {
          activeChatId: migratedChat.id,
          chats: [migratedChat],
          theme,
        };
      }
    }
  } catch {
    localStorage.removeItem(threadsStorageKey);
  }

  return {
    activeChatId: null,
    chats: null,
    theme,
  };
}

export function writeChatHydrationState({
  activeChatId,
  chats,
  theme,
}: {
  activeChatId: string;
  chats: ChatSession[];
  theme: ThemeMode | null;
}) {
  const activeId = chats.some((chat) => chat.id === activeChatId)
    ? activeChatId
    : chats[0]?.id ?? initialChat.id;

  const stored: StoredThreadState = {
    activeChatId: activeId,
    chats: chats.slice(0, maxStoredChats).map((chat) => ({
      ...chat,
      messages: chat.messages.slice(-maxStoredMessages),
    })),
    ...(theme ? { theme } : {}),
  };

  localStorage.setItem(threadsStorageKey, JSON.stringify(stored));
  if (theme) {
    localStorage.setItem(themeStorageKey, theme);
    localStorage.setItem(themeOverrideStorageKey, "true");
  } else {
    localStorage.removeItem(themeStorageKey);
    localStorage.removeItem(themeOverrideStorageKey);
  }
}
