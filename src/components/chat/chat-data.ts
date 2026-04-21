import { productBrand } from "@/lib/admissions/brand";
import type { ChatSession } from "./chat-types";

export const starterChips = [
  "Какие документы нужны?",
  "В какую страну лучше поступать?",
  "Нужен ли IELTS?",
  "Я хочу начать поступление",
];

export const draftChatTitles = [
  "План поступления без паники",
  "Маршрут к университету",
  "IELTS и дедлайны рядом",
  "Страна, бюджет, старт",
  "Документы без хаоса",
  "Виза и спокойный план",
  "Гранты и реальный бюджет",
  "Университеты под цель",
];

export const storageKey = productBrand.storageKey;
export const threadsStorageKey = `${storageKey}.threads`;
export const themeStorageKey = `${storageKey}.theme`;
export const themeOverrideStorageKey = `${themeStorageKey}.override`;
export const maxStoredChats = 16;
export const maxStoredMessages = 60;

export const welcomeBackdropText = "С чего нам начать?";
export const welcomeBackdropSubtext = "Atlas 1.0.0";
export const legacyWelcomeContent = `Здравствуйте. Я ${productBrand.assistantName}. Помогу быстро разобраться со странами, документами, IELTS, дедлайнами, стоимостью и следующим шагом.`;

export const initialChat: ChatSession = {
  id: "initial",
  title: draftChatTitles[0],
  createdAt: 0,
  updatedAt: 0,
  messages: [],
  memory: {},
  leadProfile: {},
};
