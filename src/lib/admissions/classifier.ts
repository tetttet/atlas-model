import { countries, handoffTriggers } from "./site-content";
import type {
  AdmissionIntent,
  IntentResult,
  StudentMemory,
  StudyLevel,
} from "./types";

const intentKeywords: Record<AdmissionIntent, string[]> = {
  documents: [
    "документ",
    "паспорт",
    "аттестат",
    "диплом",
    "транскрипт",
    "мотивацион",
    "рекомендац",
    "cv",
    "резюме",
    "портфолио",
    "document",
  ],
  country_fit: [
    "куда",
    "страна",
    "лучше",
    "выбрать",
    "подойдет",
    "поступить",
    "канада",
    "canada",
    "германия",
    "germany",
    "италия",
    "italy",
    "нидерланды",
    "netherlands",
    "сша",
    "usa",
    "америка",
    "великобритания",
    "uk",
  ],
  language_test: [
    "ielts",
    "toefl",
    "duolingo",
    "язык",
    "английск",
    "немецк",
    "сертификат",
    "waiver",
    "language",
  ],
  pricing: [
    "стоимость",
    "цена",
    "бюджет",
    "сколько",
    "деньги",
    "tuition",
    "стипенд",
    "scholarship",
    "расход",
    "оплата",
  ],
  deadlines: [
    "дедлайн",
    "deadline",
    "срок",
    "когда",
    "intake",
    "осень",
    "весна",
    "подача",
    "успеть",
  ],
  visa: [
    "виза",
    "visa",
    "консуль",
    "посоль",
    "cas",
    "i-20",
    "mvv",
    "proof of funds",
    "банк",
    "биометр",
    "интервью",
  ],
  process: [
    "процесс",
    "этап",
    "как проходит",
    "план",
    "roadmap",
    "шаг",
    "сначала",
  ],
  universities: [
    "университет",
    "вуз",
    "программа",
    "специальность",
    "shortlist",
    "рейтинг",
    "faculty",
    "major",
  ],
  application_start: [
    "хочу начать",
    "начать поступление",
    "оставить заявку",
    "заявка",
    "консультац",
    "менеджер",
    "старт",
    "apply",
    "start",
  ],
  complex_case: [
    "сложный",
    "индивидуальный",
    "отказ",
    "низкий gpa",
    "gap year",
    "академический",
    "срочно",
    "проблем",
    "необычный",
    "не знаю что делать",
  ],
  services: ["услуги", "пакет", "сопровождение", "что делаете", "помощь"],
  contact: ["контакт", "email", "телефон", "whatsapp", "связаться", "адрес"],
  general: [
    "привет",
    "здравствуйте",
    "hello",
    "hi",
    "помоги",
    "расскажи",
    "ты ии",
    "ты ai",
    "ты бот",
    "искусственный интеллект",
    "кто ты",
  ],
};

const levelSignals: Array<[StudyLevel, string[]]> = [
  ["foundation", ["foundation", "pathway", "подготовительн"]],
  ["bachelor", ["бакалавр", "bachelor", "undergraduate", "школ", "аттестат"]],
  ["master", ["магистр", "master", "msc", "ma", "mba", "диплом"]],
  ["phd", ["phd", "докторан", "аспиран"]],
  ["language", ["языковые курсы", "language course"]],
];

function normalize(input: string) {
  return input.toLocaleLowerCase("ru").trim();
}

function includesKeyword(text: string, keyword: string) {
  return text.includes(keyword.toLocaleLowerCase("ru"));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function classifyIntent(message: string): IntentResult {
  const normalized = normalize(message);
  const scored = Object.entries(intentKeywords).map(([intent, keywords]) => {
    const matchedKeywords = keywords.filter((keyword) =>
      includesKeyword(normalized, keyword),
    );

    const phraseBoost = matchedKeywords.some((keyword) => keyword.includes(" "))
      ? 2
      : 0;

    return {
      intent: intent as AdmissionIntent,
      matchedKeywords,
      score: matchedKeywords.length + phraseBoost,
    };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];
  const needsHuman =
    best.intent === "complex_case" ||
    handoffTriggers.some((trigger) => includesKeyword(normalized, trigger));

  if (!best || best.score === 0) {
    return {
      intent: needsHuman ? "complex_case" : "general",
      confidence: needsHuman ? 0.72 : 0.35,
      matchedKeywords: [],
      needsHuman,
    };
  }

  return {
    intent: needsHuman ? "complex_case" : best.intent,
    confidence: Math.min(0.96, 0.45 + best.score * 0.14),
    matchedKeywords: best.matchedKeywords,
    needsHuman,
  };
}

export function updateMemory(
  previous: StudentMemory | undefined,
  message: string,
  intent: AdmissionIntent,
): StudentMemory {
  const normalized = normalize(message);
  const next: StudentMemory = {
    ...previous,
    lastIntent: intent,
  };

  const level = levelSignals.find(([, keywords]) =>
    keywords.some((keyword) => includesKeyword(normalized, keyword)),
  )?.[0];

  if (level) {
    next.level = level;
  }

  const mentionedCountries = countries
    .filter((country) => {
      const aliases = [
        country.name,
        country.slug,
        country.slug === "uk" ? "великобритания" : "",
        country.slug === "usa" ? "сша" : "",
        country.slug === "netherlands" ? "нидерланды" : "",
      ].filter(Boolean);

      return aliases.some((alias) => includesKeyword(normalized, alias));
    })
    .map((country) => country.name);

  if (mentionedCountries.length > 0) {
    next.countries = unique([...(previous?.countries ?? []), ...mentionedCountries]);
  }

  const budgetMatch = normalized.match(
    /(?:бюджет|budget|до|около|примерно)\s*([0-9][0-9\s.,]*)\s*(usd|eur|gbp|cad|евро|доллар|долларов|фунт|тыс|k)?/,
  );

  if (budgetMatch) {
    next.budget = budgetMatch[0];
  }

  const languageMatch = normalized.match(/ielts\s*([0-9][.,]?[0-9])?|toefl|duolingo/);

  if (languageMatch) {
    next.languageTest = languageMatch[0].toUpperCase();
  }

  const deadlineMatch = normalized.match(
    /(осень|весна|сентябрь|январь|2026|2027|2028|fall|spring|winter intake|summer intake)/,
  );

  if (deadlineMatch) {
    next.deadline = deadlineMatch[0];
  }

  const programMatch = normalized.match(
    /(computer science|business|data|design|engineering|medicine|law|finance|маркетинг|бизнес|дизайн|айти|it|медицина|право|финансы)/,
  );

  if (programMatch) {
    next.program = programMatch[0];
  }

  next.summary = buildMemorySummary(next);

  return next;
}

function buildMemorySummary(memory: StudentMemory) {
  const parts = [
    memory.level && `уровень: ${memory.level}`,
    memory.countries && memory.countries.length > 0
      ? `страны: ${memory.countries.join(", ")}`
      : undefined,
    memory.program && `направление: ${memory.program}`,
    memory.budget && `бюджет: ${memory.budget}`,
    memory.languageTest && `язык: ${memory.languageTest}`,
    memory.deadline && `intake/срок: ${memory.deadline}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("; ") : undefined;
}
