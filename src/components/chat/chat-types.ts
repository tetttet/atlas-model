import type {
  BotReply,
  LeadProfile,
  StudentMemory,
} from "@/lib/admissions/types";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  reply?: BotReply;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  memory: StudentMemory;
  leadProfile: LeadProfile;
};

export type ThemeMode = "light" | "dark";

export type StoredChatState = {
  messages: ChatMessage[];
  memory: StudentMemory;
  leadProfile: LeadProfile;
};

export type StoredThreadState = {
  activeChatId: string;
  chats: ChatSession[];
  theme?: ThemeMode;
};
