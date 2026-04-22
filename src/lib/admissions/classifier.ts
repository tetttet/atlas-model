import { countries, handoffTriggers } from "./site-content";
import type {
  AdmissionIntent,
  LeadProfile,
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
    "sop",
    "essay",
    "эссе",
    "рекомендац",
    "cv",
    "резюме",
    "портфолио",
    "перевод",
    "нотариус",
    "document",
    "доки",
    "бумаги",
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
    "франция",
    "france",
    "испания",
    "spain",
    "австралия",
    "australia",
    "ирландия",
    "ireland",
    "турция",
    "турцию",
    "турции",
    "турци",
    "turkey",
    "türkiye",
    "европа",
    "europe",
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
    "скок",
    "деньги",
    "tuition",
    "стипенд",
    "грант",
    "scholarship",
    "financial aid",
    "расход",
    "оплата",
    "дешево",
    "недорого",
    "экономно",
  ],
  deadlines: [
    "дедлайн",
    "дедлайны",
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
    "после offer",
    "оффер",
    "pre-departure",
    "перед вылетом",
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
    "foundation",
    "pathway",
    "pre-master",
    "portfolio",
    "activities",
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
    "перерыв",
    "академический",
    "срочно",
    "проблем",
    "необычный",
    "не знаю что делать",
    "смена специальности",
    "плохие оценки",
    "отчислили",
    "гарантия",
    "точные шансы",
  ],
  services: [
    "услуги",
    "пакет",
    "сопровождение",
    "что делаете",
    "что можете",
    "чем помогаете",
    "помощь",
  ],
  contact: [
    "контакт",
    "email",
    "телефон",
    "whatsapp",
    "instagram",
    "инстаграм",
    "инста",
    "соцсети",
    "связаться",
    "адрес",
  ],
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
  [
    "bachelor",
    ["бакалавр", "бакал", "бак", "bachelor", "undergraduate", "школ", "аттестат"],
  ],
  ["master", ["магистр", "маг", "мага", "master", "msc", "ma", "mba", "диплом"]],
  ["phd", ["phd", "докторан", "аспиран"]],
  ["language", ["языковые курсы", "language course"]],
];

const languagePreferenceSignals: Array<[string, string[]]> = [
  ["английский", ["английск", "англ", "english", "eng", "на английском"]],
  ["турецкий", ["турецк", "турк", "turkish", "на турецком"]],
  ["немецкий", ["немецк", "нем", "german", "на немецком"]],
  ["французский", ["французск", "франц", "french", "на французском"]],
  ["испанский", ["испанск", "испан", "spanish", "на испанском"]],
  ["итальянский", ["итальянск", "итал", "italian", "на итальянском"]],
  ["русский", ["русск", "russian", "на русском"]],
];

export type MessageFacts = {
  level?: StudyLevel;
  countries: string[];
  excludedCountries: string[];
  countrySelectionMode?: "merge" | "replace";
  program?: string;
  language?: string;
  budget?: string;
  languageTest?: string;
  deadline?: string;
};

function normalize(input: string) {
  return input.toLocaleLowerCase("ru").trim();
}

function includesKeyword(text: string, keyword: string) {
  return text.includes(keyword.toLocaleLowerCase("ru"));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function countryAliases(country: (typeof countries)[number]) {
  return [
    country.name,
    country.slug,
    country.name.slice(0, Math.max(4, country.name.length - 2)),
    country.slug === "uk" ? "великобритания" : "",
    country.slug === "usa" ? "сша" : "",
    country.slug === "usa" ? "америка" : "",
    country.slug === "netherlands" ? "нидерланды" : "",
    country.slug === "germany" ? "германи" : "",
    country.slug === "italy" ? "итали" : "",
    country.slug === "france" ? "франци" : "",
    country.slug === "spain" ? "испан" : "",
    country.slug === "australia" ? "австрали" : "",
    country.slug === "ireland" ? "ирланди" : "",
    country.slug === "turkey" ? "турц" : "",
    country.slug === "turkey" ? "турцию" : "",
    country.slug === "turkey" ? "турки" : "",
  ].filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countryAliasPattern(alias: string) {
  return `${escapeRegExp(alias)}[a-zа-яё]*`;
}

function hasCountryAlias(text: string, country: (typeof countries)[number]) {
  return countryAliases(country).some((alias) =>
    includesKeyword(text, alias),
  );
}

function isCountryExcluded(text: string, country: (typeof countries)[number]) {
  return countryAliases(country).some((alias) => {
    const countryPattern = countryAliasPattern(alias);
    const patterns = [
      new RegExp(
        `(^|\\s)(?:нет\\s+не|не|без|кроме)\\s+(?:в\\s+|во\\s+|по\\s+)?${countryPattern}(?=\\s|$)`,
      ),
      new RegExp(
        `(^|\\s)(?:убери|убрать|исключи|исключить|удали|удалить)\\s+(?:из\\s+списка\\s+)?(?:в\\s+|во\\s+|по\\s+)?${countryPattern}(?=\\s|$)`,
      ),
      new RegExp(
        `(^|\\s)вместо\\s+(?:в\\s+|во\\s+|по\\s+)?${countryPattern}(?=\\s|$)`,
      ),
      new RegExp(
        `(^|\\s)${countryPattern}\\s+(?:не\\s+надо|не\\s+нужно|не\\s+рассматриваем|не\\s+хочу)(?=\\s|$)`,
      ),
    ];

    return patterns.some((pattern) => pattern.test(text));
  });
}

function hasExclusiveCountrySignal(text: string) {
  return /(^|\s)(?:только|тока|лишь|исключительно|вместо)(\s|$)/.test(
    text,
  );
}

function countMessageFacts(facts: MessageFacts) {
  return [
    facts.level,
    facts.countries.length > 0 ? facts.countries.join(",") : undefined,
    facts.excludedCountries.length > 0
      ? facts.excludedCountries.join(",")
      : undefined,
    facts.program,
    facts.language,
    facts.budget,
    facts.languageTest,
    facts.deadline,
  ].filter(Boolean).length;
}

function formatBudget(amount?: string, currency?: string) {
  const cleanAmount = amount?.trim();
  const cleanCurrency = currency?.trim();

  if (!cleanAmount) {
    return undefined;
  }

  if (!cleanCurrency) {
    return cleanAmount;
  }

  return cleanCurrency === "k" || cleanCurrency === "к"
    ? `${cleanAmount}${cleanCurrency}`
    : `${cleanAmount} ${cleanCurrency}`;
}

function hasActiveProfileContext(
  memory?: StudentMemory,
  leadProfile?: LeadProfile,
) {
  return Boolean(
    memory?.summary ||
      memory?.lastIntent ||
      memory?.level ||
      memory?.countries?.length ||
      memory?.program ||
      memory?.language ||
      memory?.budget ||
      memory?.languageTest ||
      memory?.deadline ||
      leadProfile?.summary ||
      leadProfile?.level ||
      leadProfile?.targetCountries?.length ||
      leadProfile?.program ||
      leadProfile?.language ||
      leadProfile?.budget ||
      leadProfile?.languageTest ||
      leadProfile?.deadline,
  );
}

function intentFromFacts(facts: MessageFacts): AdmissionIntent {
  if (facts.budget) {
    return "pricing";
  }

  if (facts.language || facts.languageTest) {
    return "language_test";
  }

  if (facts.program) {
    return "universities";
  }

  return "country_fit";
}

function fallbackIntentFromFacts(
  facts: MessageFacts,
  previous?: StudentMemory,
  preferPrevious = true,
): AdmissionIntent {
  if (preferPrevious && previous?.lastIntent && previous.lastIntent !== "general") {
    return previous.lastIntent;
  }

  return intentFromFacts(facts);
}

function hasQuestionSignal(text: string) {
  return (
    text.includes("?") ||
    [
      "сколько",
      "скок",
      "какие",
      "какой",
      "какая",
      "как ",
      "когда",
      "зачем",
      "почему",
      "нужн",
      "можно",
      "получится",
      "хватит",
      "подойдет",
      "подойдёт",
      "что делать",
      "куда",
      "сравни",
    ].some((signal) => text.includes(signal))
  );
}

function directIntentFromQuestion(text: string): AdmissionIntent | undefined {
  if (!hasQuestionSignal(text)) {
    return undefined;
  }

  if (hasTextSignal(text, ["виза", "visa", "консуль", "посоль", "proof of funds"])) {
    return "visa";
  }

  if (hasTextSignal(text, ["документ", "доки", "бумаги", "аттестат", "диплом", "sop", "cv"])) {
    return "documents";
  }

  if (
    hasTextSignal(text, [
      "сколько",
      "скок",
      "стоим",
      "цена",
      "бюджет",
      "tuition",
      "грант",
      "стипенд",
      "дешев",
      "недорого",
    ])
  ) {
    return "pricing";
  }

  if (hasTextSignal(text, ["дедлайн", "срок", "когда", "intake", "успеть"])) {
    return "deadlines";
  }

  if (hasTextSignal(text, ["ielts", "toefl", "duolingo", "язык", "англ", "waiver"])) {
    return "language_test";
  }

  if (hasTextSignal(text, ["университет", "универ", "вуз", "программа", "shortlist"])) {
    return "universities";
  }

  if (hasTextSignal(text, ["процесс", "этап", "план", "что делать", "с чего"])) {
    return "process";
  }

  if (hasTextSignal(text, ["услуги", "что делаете", "что можете", "чем помогаете"])) {
    return "services";
  }

  if (hasTextSignal(text, ["контакт", "email", "телефон", "instagram", "инста", "связаться"])) {
    return "contact";
  }

  return undefined;
}

function hasTextSignal(text: string, signals: string[]) {
  return signals.some((signal) => text.includes(signal));
}

function isShortPatchLike(text: string) {
  return wordCount(text) <= 8 || text.length <= 110;
}

export function extractMessageFacts(message: string): MessageFacts {
  const normalized = normalize(message).replace(/[!?.,;:()[\]{}"']/g, " ");
  const level = levelSignals.find(([, keywords]) =>
    keywords.some((keyword) => includesKeyword(normalized, keyword)),
  )?.[0];
  const mentionedCountries = countries.filter((country) =>
    hasCountryAlias(normalized, country),
  );
  const excludedCountries = mentionedCountries
    .filter((country) => isCountryExcluded(normalized, country))
    .map((country) => country.name);
  const countriesMentioned = mentionedCountries
    .map((country) => country.name)
    .filter((country) => !excludedCountries.includes(country));
  const countrySelectionMode =
    hasExclusiveCountrySignal(normalized) ||
    (countriesMentioned.length > 0 && excludedCountries.length > 0)
      ? "replace"
      : undefined;
  const budgetMatch =
    normalized.match(
      /(?:бюджет|budget|до|около|примерно)\s*([0-9][0-9\s.,]*(?:[-–][0-9][0-9\s.,]*)?)\s*(usd|eur|gbp|cad|try|tl|евро|доллар|долларов|фунт|лир|тыс|тысяч|k|к)?/,
    ) ??
    normalized.match(
      /\b([0-9][0-9\s.,]*(?:[-–][0-9][0-9\s.,]*)?)\s*(usd|eur|gbp|cad|try|tl|евро|доллар|долларов|фунт|лир|тыс|тысяч|k|к)\b/,
    );
  const standaloneBudgetMatch = normalized.match(
    /(^|\s)([0-9][0-9\s.,]*(?:[-–][0-9][0-9\s.,]*)?)\s*(k|к|тыс|тысяч)(?=\s|$)/,
  );
  const languageTestMatch = normalized.match(
    /ielts\s*([0-9][.,]?[0-9])?|toefl\s*([0-9]{2,3})?|duolingo\s*([0-9]{2,3})?|pte\s*([0-9]{2,3})?/,
  );
  const language = languagePreferenceSignals.find(([, keywords]) =>
    keywords.some((keyword) => includesKeyword(normalized, keyword)),
  )?.[0];
  const deadlineMatch = normalized.match(
    /(осень|весна|сентябрь|январь|2026|2027|2028|2029|fall|spring|winter intake|summer intake)/,
  );
  const programMatch = normalized.match(
    /(computer science|software|programming|business|data|design|engineering|medicine|law|finance|marketing|architecture|hospitality|management|psychology|ai|ux|cs|компьютерн|программирован|маркетинг|бизнес|дизайн|айти|it|медицина|право|финансы|архитектура|гостинич|менеджмент|психолог|искусственный интеллект|аналитика|туризм)/,
  );

  return {
    level,
    countries: unique(countriesMentioned),
    excludedCountries: unique(excludedCountries),
    countrySelectionMode,
    program: programMatch?.[0],
    language,
    budget:
      budgetMatch && /[0-9]/.test(budgetMatch[0])
        ? formatBudget(budgetMatch[1], budgetMatch[2])
        : standaloneBudgetMatch && /[0-9]/.test(standaloneBudgetMatch[0])
          ? formatBudget(standaloneBudgetMatch[2], standaloneBudgetMatch[3])
          : undefined,
    languageTest: languageTestMatch?.[0].toUpperCase(),
    deadline: deadlineMatch?.[0],
  };
}

export function classifyIntent(
  message: string,
  previousMemory?: StudentMemory,
  previousLeadProfile?: LeadProfile,
): IntentResult {
  const normalized = normalize(message);
  const facts = extractMessageFacts(message);
  const factsCount = countMessageFacts(facts);
  const hasContext = hasActiveProfileContext(previousMemory, previousLeadProfile);
  const asksQuestion = hasQuestionSignal(normalized);
  const isShortSlotReply =
    factsCount > 0 && isShortPatchLike(normalized) && !asksQuestion;
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
  const directQuestionIntent = directIntentFromQuestion(normalized);
  const previousIntent = previousMemory?.lastIntent;
  const shouldInheritConversation =
    isShortSlotReply &&
    hasContext &&
    previousIntent &&
    previousIntent !== "general";

  if (directQuestionIntent && !needsHuman) {
    return {
      intent: directQuestionIntent,
      confidence: 0.72,
      matchedKeywords: [directQuestionIntent],
      needsHuman,
    };
  }

  if (shouldInheritConversation && previousIntent) {
    return {
      intent: previousIntent,
      confidence: 0.68,
      matchedKeywords: [
        ...best.matchedKeywords,
        ...Object.values(facts)
          .flat()
          .filter((value): value is string => typeof value === "string"),
      ],
      needsHuman,
    };
  }

  if (!best || best.score === 0) {
    if (factsCount > 0) {
      return {
        intent: fallbackIntentFromFacts(facts, previousMemory, !asksQuestion),
        confidence: hasContext ? 0.66 : 0.58,
        matchedKeywords: Object.values(facts)
          .flat()
          .filter((value): value is string => typeof value === "string"),
        needsHuman,
      };
    }

    if (
      hasContext &&
      previousIntent &&
      previousIntent !== "general" &&
      isShortPatchLike(normalized)
    ) {
      return {
        intent: previousIntent,
        confidence: 0.52,
        matchedKeywords: ["context-continuation"],
        needsHuman,
      };
    }

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
  const facts = extractMessageFacts(message);
  const next: StudentMemory = {
    ...previous,
    lastIntent: intent,
  };

  if (facts.level) {
    next.level = facts.level;
  }

  if (facts.countries.length > 0) {
    next.countries =
      facts.countrySelectionMode === "replace"
        ? facts.countries
        : unique([...(previous?.countries ?? []), ...facts.countries]);
  }

  if (facts.excludedCountries.length > 0) {
    const excludedCountries = new Set(facts.excludedCountries);
    const filteredCountries = (next.countries ?? previous?.countries ?? []).filter(
      (country) => !excludedCountries.has(country),
    );

    if (filteredCountries.length > 0) {
      next.countries = filteredCountries;
    } else {
      delete next.countries;
    }
  }

  if (facts.budget) {
    next.budget = facts.budget;
  }

  if (facts.language) {
    next.language = facts.language;
  }

  if (facts.languageTest) {
    next.languageTest = facts.languageTest;
  }

  if (facts.deadline) {
    next.deadline = facts.deadline;
  }

  if (facts.program) {
    next.program = facts.program;
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
    memory.language && `язык обучения: ${memory.language}`,
    memory.budget && `бюджет: ${memory.budget}`,
    memory.languageTest && `тест: ${memory.languageTest}`,
    memory.deadline && `intake/срок: ${memory.deadline}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("; ") : undefined;
}
