import {
  draftChatTitles,
  legacyWelcomeContent,
  maxStoredMessages,
} from "./chat-data";
import type { ChatMessage, ChatSession, ThemeMode } from "./chat-types";

export function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyChat(index = 0): ChatSession {
  const now = Date.now();

  return {
    id: createId(),
    title: draftChatTitles[index % draftChatTitles.length],
    createdAt: now,
    updatedAt: now,
    messages: [],
    memory: {},
    leadProfile: {},
  };
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function getDeviceTheme(): ThemeMode {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "assistant" || message.role === "user") &&
    typeof message.content === "string"
  );
}

export function removeLegacyWelcomeMessages(messages: ChatMessage[]) {
  return messages.filter(
    (message) =>
      !(
        message.role === "assistant" &&
        !message.reply &&
        (message.id === "welcome" || message.content === legacyWelcomeContent)
      ),
  );
}

function cleanTitle(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 64) : fallback;
}

export function titleFromMessage(message: string) {
  const text = message.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  if (/(ielts|toefl|англ|язык)/i.test(lower)) {
    return "IELTS: что реально нужно";
  }

  if (/(документ|аттестат|диплом|сертификат)/i.test(lower)) {
    return "Документы без хаоса";
  }

  if (
    /(страна|куда|турци|европ|канада|сша|германи|польша|корея)/i.test(lower)
  ) {
    return "Выбор страны для учебы";
  }

  if (/(стоим|цена|бюджет|грант|скидк|оплат)/i.test(lower)) {
    return "Бюджет и гранты без тумана";
  }

  if (/(виза|visa|посольств)/i.test(lower)) {
    return "Виза и спокойный план";
  }

  if (/(дедлайн|срок|когда|успеть)/i.test(lower)) {
    return "Дедлайны под контролем";
  }

  if (/(начать|старт|поступ|заявк)/i.test(lower)) {
    return "Старт поступления";
  }

  const shortText = text.length > 42 ? `${text.slice(0, 39).trim()}...` : text;
  return shortText ? `Разбор: ${shortText}` : draftChatTitles[0];
}

export function titleFromMessages(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  return firstUserMessage
    ? titleFromMessage(firstUserMessage.content)
    : draftChatTitles[0];
}

export function normalizeChat(value: unknown, index: number): ChatSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const chat = value as Partial<ChatSession>;
  const messages = Array.isArray(chat.messages)
    ? removeLegacyWelcomeMessages(chat.messages.filter(isChatMessage)).slice(
        -maxStoredMessages,
      )
    : [];

  const fallbackTitle = titleFromMessages(messages);
  const now = Date.now();

  return {
    id: typeof chat.id === "string" ? chat.id : createId(),
    title: cleanTitle(chat.title, fallbackTitle || draftChatTitles[index]),
    createdAt: typeof chat.createdAt === "number" ? chat.createdAt : now,
    updatedAt: typeof chat.updatedAt === "number" ? chat.updatedAt : now,
    messages,
    memory:
      chat.memory && typeof chat.memory === "object" ? chat.memory : {},
    leadProfile:
      chat.leadProfile && typeof chat.leadProfile === "object"
        ? chat.leadProfile
        : {},
  };
}
