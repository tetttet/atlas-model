import {
  classifyIntent,
  extractMessageFacts,
  updateMemory,
  type MessageFacts,
} from "./classifier";
import {
  GeminiRequestError,
  askGemini,
  askGeminiStream,
  getGeminiCooldownMs,
  hasGeminiConfig,
  isGeminiTemporarilyUnavailable,
  type GeminiInput,
} from "./gemini";
import { ADMISSIONS_SYSTEM_PROMPT } from "./prompt";
import { extractLeadProfile, mergeLeadProfile } from "./profile";
import { compactContext, retrieveKnowledge } from "./retrieval";
import { productBrand } from "./brand";
import {
  localRouterTopicChips,
  localRouterTopicLabel,
  routeMessageLocally,
  type LocalRouterResult,
  type LocalRouterTopic,
} from "./local-router";
import {
  countries,
  companyContacts,
  documentChecklists,
  routingRules,
  services,
} from "./site-content";
import type {
  AdmissionIntent,
  BotReply,
  ChatAction,
  KnowledgeChunk,
  LeadProfile,
  LinkTarget,
  StudentMemory,
  StudyLevel,
} from "./types";

const defaultChips = [
  "Какие документы нужны?",
  "В какую страну лучше поступать?",
  "Сколько стоит обучение?",
  "Я хочу начать поступление",
];

type GeminiMode = "off" | "simple" | "complex";

type ChatTurn = {
  userMessage: string;
  previousMemory?: StudentMemory;
  previousLeadProfile?: LeadProfile;
  turnFacts: MessageFacts;
  routerResult: LocalRouterResult;
  intentResult: {
    intent: AdmissionIntent;
    confidence: number;
    matchedKeywords: string[];
    needsHuman: boolean;
  };
  memory: StudentMemory;
  chunks: KnowledgeChunk[];
  handoff: boolean;
  leadProfile: LeadProfile;
  scopeIssue?: ScopeIssue;
  baseReply: BotReply;
  useGemini: boolean;
};

type GeminiAskFunction = (input: GeminiInput) => ReturnType<typeof askGemini>;

type ScopeIssue =
  | {
      kind: "unsupported_service";
    }
  | {
      kind: "unsupported_country";
      country: string;
    };

const unsupportedCountryAliases: Array<[string, string[]]> = [
  ["Австрия", ["австри", "austria"]],
  ["Бельгия", ["бельги", "belgium"]],
  ["Венгрия", ["венгри", "hungary"]],
  ["Дания", ["дани", "denmark"]],
  ["Дубай/ОАЭ", ["дубай", "оаэ", "эмират", "uae", "dubai"]],
  ["Китай", ["китай", "china"]],
  ["Корея", ["коре", "korea"]],
  ["Малайзия", ["малайзи", "malaysia"]],
  ["Польша", ["польш", "poland"]],
  ["Сингапур", ["сингапур", "singapore"]],
  ["Финляндия", ["финлянди", "finland"]],
  ["Чехия", ["чехи", "czech"]],
  ["Швейцария", ["швейцари", "switzerland"]],
  ["Швеция", ["швеци", "sweden"]],
  ["Япония", ["япони", "japan"]],
];

function uniqueLinks(chunks: KnowledgeChunk[], extra: LinkTarget[] = []) {
  const map = new Map<string, LinkTarget>();

  [...chunks.flatMap((chunk) => chunk.links), ...extra].forEach((link) => {
    map.set(link.href, link);
  });

  return Array.from(map.values()).slice(0, 3);
}

function routeForIntent(intent: AdmissionIntent) {
  return routingRules.find((rule) => rule.intent === intent);
}

function actionForIntent(intent: AdmissionIntent, handoff: boolean): ChatAction[] {
  const rule = routeForIntent(intent);
  const actions: ChatAction[] = [];

  if (rule) {
    actions.push({
      type: handoff ? "handoff" : intent === "application_start" ? "lead" : "link",
      label: rule.cta,
      href: rule.page,
    });
  }

  if (handoff && !actions.some((action) => action.href === "/consultation")) {
    actions.push({
      type: "handoff",
      label: "Передать менеджеру",
      href: "/consultation",
    });
  }

  return actions;
}

function chipsForIntent(intent: AdmissionIntent) {
  const byIntent: Partial<Record<AdmissionIntent, string[]>> = {
    documents: [
      "Документы для бакалавриата",
      "Документы для магистратуры",
      "Проверить SOP и CV",
      "Нужны ли переводы?",
    ],
    country_fit: [
      "Бюджет до 15 000 EUR",
      "Хочу учиться на английском",
      "Сравни Канаду и Европу",
      "Какая страна дешевле?",
    ],
    language_test: [
      "Нужен ли IELTS?",
      "Можно без IELTS?",
      "Какой балл нужен?",
    ],
    pricing: [
      "Бюджет для Европы",
      "Стоимость Канады",
      "Есть ли стипендии?",
      "Можно только с грантом?",
    ],
    deadlines: [
      "Дедлайны на осень",
      "Я опаздываю со сроками",
      "Когда начинать?",
      "План на 12 месяцев",
    ],
    visa: [
      "Какие документы на визу?",
      "Был отказ в визе",
      "Нужен proof of funds",
    ],
    application_start: [
      "Бакалавриат",
      "Магистратура",
      "Нужна консультация",
      "Собрать мои данные",
    ],
    complex_case: [
      "Передать менеджеру",
      "Какие данные нужны?",
      "Записаться на консультацию",
      "Что делать с низким GPA?",
    ],
    universities: [
      "Собрать safety/target/reach",
      "IT и Data программы",
      "Нужен ли portfolio?",
      "Смена специальности",
    ],
    process: [
      "План по месяцам",
      "Что после offer?",
      "Pre-departure checklist",
      "С чего начать?",
    ],
    contact: [
      "Instagram фирмы",
      "Email для связи",
      "Оставить заявку",
      "Какие данные отправить?",
    ],
  };

  return byIntent[intent] ?? defaultChips;
}

function compactList(items: string[], limit = 5) {
  return items.slice(0, limit).map((item) => `- ${item}`).join("\n");
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function normalizeForScope(text: string) {
  return text
    .toLocaleLowerCase("ru")
    .replace(/[!?.,;:()[\]{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAdmissionSignal(text: string) {
  return hasAny(text, [
    "поступ",
    "учеб",
    "учиться",
    "универс",
    "универ",
    "вуз",
    "колледж",
    "бакалавр",
    "магистр",
    "foundation",
    "master",
    "bachelor",
    "admission",
    "apply",
    "study",
  ]);
}

function detectUnsupportedService(text: string) {
  return [
    /(^|\s)(сделай|сделать|создай|создать|разработай|разработать)(\s+\S+){0,3}\s+(сайт|лендинг|приложение|бота|магазин)(\s|$)/,
    /(^|\s)(напиши|написать|почини|починить|объясни|объяснить)(\s+\S+){0,3}\s+(код|скрипт|программу)(\s|$)/,
    /(^|\s)(реши|решить|сделай|сделать)(\s+\S+){0,3}\s+(домашк|дз|задач|контрольн|экзамен)(\s|$)/,
    /(^|\s)(напиши|написать|сделай|сделать|купи|купить)(\s+\S+){0,3}\s+(курсов|реферат|дипломн)(\s|$)/,
    /(^|\s)(купи|купить|сделай|сделать|подделай|подделать)(\s+\S+){0,3}\s+(диплом|сертификат|справк|визу)(\s|$)/,
    /(^|\s)(туристическ|рабоч)[а-яёa-z]*\s+виз/,
    /(^|\s)(найди|найдите|устроить|устрой)(\s+\S+){0,3}\s+работ/,
    /(^|\s)(отель|билет|авиабилет|турпакет|туристическ)[а-яёa-z]*(\s|$)/,
    /(^|\s)(налог|бухгалтер|адвокат|юрист|медицинск|диагноз|лечение)[а-яёa-z]*(\s|$)/,
  ].some((pattern) => pattern.test(text));
}

function detectUnsupportedCountry(text: string) {
  const mentionsSupportedCountry = countries.some((country) =>
    [country.name, country.slug].some((value) =>
      text.includes(value.toLocaleLowerCase("ru")),
    ),
  );

  if (mentionsSupportedCountry || !hasAdmissionSignal(text)) {
    return undefined;
  }

  return unsupportedCountryAliases.find(([, aliases]) =>
    aliases.some((alias) => text.includes(alias)),
  )?.[0];
}

function detectScopeIssue(userMessage: string): ScopeIssue | undefined {
  const normalized = normalizeForScope(userMessage);

  if (!normalized || hasGreetingSignal(normalized)) {
    return undefined;
  }

  if (detectUnsupportedService(normalized)) {
    return { kind: "unsupported_service" };
  }

  const unsupportedCountry = detectUnsupportedCountry(normalized);

  if (unsupportedCountry) {
    return {
      kind: "unsupported_country",
      country: unsupportedCountry,
    };
  }

  return undefined;
}

function supportedServicesSummary() {
  return [
    "диагностика профиля",
    "подбор стран и программ",
    "shortlist университетов",
    "документы и заявки",
    "бюджет, стипендии и дедлайны",
    "общий чеклист студенческой визы",
    "сопровождение менеджером",
  ].join(", ");
}

function supportedCountriesSummary() {
  return countries.map((country) => country.name).join(", ");
}

function buildScopeGuardAnswer(scopeIssue: ScopeIssue) {
  if (scopeIssue.kind === "unsupported_country") {
    return [
      `По направлению "${scopeIssue.country}" сейчас нет детальной проверенной базы Atlas, поэтому я не буду выдумывать требования, сроки или цены.`,
      `Сейчас в базе есть: ${supportedCountriesSummary()}.`,
      `Мы можем помочь с такими задачами: ${supportedServicesSummary()}.`,
      "Если хотите, напишите страну из списка или коротко опишите цель, и я продолжу в рамках доступной базы.",
    ].join("\n");
  }

  return [
    "Извините, такую услугу мы не предоставляем и я не буду придумывать ответ вне базы Atlas.",
    `Мы помогаем с поступлением за границу: ${supportedServicesSummary()}.`,
    "Если ваш вопрос про поступление, напишите страну, уровень обучения и направление - продолжу по ним.",
  ].join("\n");
}

function scopeGuardChips(scopeIssue: ScopeIssue) {
  if (scopeIssue.kind === "unsupported_country") {
    return [
      "Показать страны в базе",
      "Подобрать страну",
      "Какие услуги есть?",
      "Начать с профиля",
    ];
  }

  return [
    "Какие услуги есть?",
    "Подобрать страну",
    "Документы для поступления",
    "С чего начать?",
  ];
}

function factCount(facts: MessageFacts) {
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

function profileFactCount(memory: StudentMemory, leadProfile?: LeadProfile) {
  return [
    memory.level ?? leadProfile?.level,
    (memory.countries?.length ?? 0) > 0 ||
    (leadProfile?.targetCountries?.length ?? 0) > 0
      ? "country"
      : undefined,
    memory.program ?? leadProfile?.program,
    memory.language ?? leadProfile?.language,
    memory.budget ?? leadProfile?.budget,
    memory.languageTest ?? leadProfile?.languageTest,
    memory.deadline ?? leadProfile?.deadline,
  ].filter(Boolean).length;
}

function primaryCountry(memory: StudentMemory, leadProfile?: LeadProfile) {
  return memory.countries?.[0] ?? leadProfile?.targetCountries?.[0];
}

function primaryLevel(memory: StudentMemory, leadProfile?: LeadProfile) {
  return memory.level ?? leadProfile?.level;
}

function displayLevel(level?: StudyLevel) {
  const labels: Partial<Record<StudyLevel, string>> = {
    foundation: "foundation/pathway",
    bachelor: "бакалавриат",
    master: "магистратура",
    phd: "PhD",
    language: "языковые курсы",
  };

  return level ? labels[level] ?? level : undefined;
}

function countryLocative(country?: string) {
  const forms: Record<string, string> = {
    Австралия: "Австралии",
    Великобритания: "Великобритании",
    Германия: "Германии",
    Ирландия: "Ирландии",
    Испания: "Испании",
    Италия: "Италии",
    Канада: "Канаде",
    Нидерланды: "Нидерландах",
    США: "США",
    Турция: "Турции",
    Франция: "Франции",
  };

  return country ? forms[country] ?? country : undefined;
}

function knownProfileFacts(memory: StudentMemory, leadProfile: LeadProfile) {
  const level = displayLevel(primaryLevel(memory, leadProfile));
  const countries =
    memory.countries && memory.countries.length > 0
      ? memory.countries
      : leadProfile.targetCountries;
  const facts = [
    countries && countries.length > 0
      ? `страна: ${countries.join(", ")}`
      : undefined,
    level && `уровень: ${level}`,
    (memory.program ?? leadProfile.program) &&
      `направление: ${memory.program ?? leadProfile.program}`,
    (memory.language ?? leadProfile.language) &&
      `язык обучения: ${memory.language ?? leadProfile.language}`,
    (memory.budget ?? leadProfile.budget) &&
      `бюджет: ${memory.budget ?? leadProfile.budget}`,
    (memory.languageTest ?? leadProfile.languageTest) &&
      `тест: ${memory.languageTest ?? leadProfile.languageTest}`,
    (memory.deadline ?? leadProfile.deadline) &&
      `intake: ${memory.deadline ?? leadProfile.deadline}`,
  ].filter(Boolean);

  return facts.join("; ");
}

export function buildNextQuestionFromMissingSlots(
  memory: StudentMemory,
  leadProfile: LeadProfile,
) {
  const country = primaryCountry(memory, leadProfile);
  const level = primaryLevel(memory, leadProfile);
  const language = memory.language ?? leadProfile.language;
  const missing: string[] = [];

  if (country && !level) {
    missing.push("уровень обучения");
  }

  if (!country) {
    missing.push("страну");
  }

  if (!country && !level) {
    missing.push("уровень");
  }

  if (!memory.program && !leadProfile.program) {
    missing.push("направление");
  }

  if (!language) {
    missing.push("язык обучения");
  }

  if (!memory.budget && !leadProfile.budget) {
    missing.push("бюджет на год");
  }

  if (
    language === "английский" &&
    !memory.languageTest &&
    !leadProfile.languageTest
  ) {
    missing.push("IELTS/TOEFL/Duolingo, если уже есть");
  }

  if (!memory.deadline && !leadProfile.deadline) {
    missing.push("желаемый intake/срок");
  }

  return uniqueStrings(missing).slice(0, 3);
}

function buildSingleNextQuestion(memory: StudentMemory, leadProfile: LeadProfile) {
  const nextSlot = buildNextQuestionFromMissingSlots(memory, leadProfile)[0];

  switch (nextSlot) {
    case "уровень обучения":
    case "уровень":
      return "Какой уровень нужен: бакалавриат, магистратура или foundation?";
    case "страну":
      return "Какая страна или регион сейчас в приоритете?";
    case "направление":
      return "Какое направление рассматриваете?";
    case "язык обучения":
      return "На каком языке хотите учиться?";
    case "бюджет на год":
      return "Какой ориентир по бюджету на год вместе с проживанием?";
    case "IELTS/TOEFL/Duolingo, если уже есть":
      return "Есть уже IELTS/TOEFL/Duolingo или пока без теста?";
    case "желаемый intake/срок":
      return "На какой intake ориентируетесь: ближайшая осень, весна или следующий год?";
    default:
      return "";
  }
}

function buildMissingSlotPrompt(memory: StudentMemory, leadProfile: LeadProfile) {
  const nextQuestion = buildSingleNextQuestion(memory, leadProfile);

  if (!nextQuestion) {
    return "Данных достаточно для первичного маршрута: дальше можно сверять shortlist, дедлайны и документы.";
  }

  return `Чтобы сузить ответ: ${nextQuestion}`;
}

function buildAcknowledgement(
  facts: MessageFacts,
  memory: StudentMemory,
  leadProfile: LeadProfile,
  userMessage?: string,
) {
  const country = primaryCountry(memory, leadProfile);
  const countryIn = countryLocative(country);
  const level = displayLevel(primaryLevel(memory, leadProfile));

  if (facts.level && countryIn && level) {
    return `Отлично, ${level} в ${countryIn}.`;
  }

  if (facts.countries.length > 0) {
    return `Понял, ${facts.countries.join(", ")}.`;
  }

  if (facts.excludedCountries.length > 0) {
    return `Понял, исключаю: ${facts.excludedCountries.join(", ")}.`;
  }

  if (facts.language) {
    return `Понял, язык обучения: ${facts.language}.`;
  }

  if (facts.budget) {
    return `Понял, бюджет: ${facts.budget}.`;
  }

  if (facts.program) {
    return `Понял, направление: ${facts.program}.`;
  }

  if (facts.languageTest) {
    return `Понял, языковой тест: ${facts.languageTest}.`;
  }

  if (facts.deadline) {
    return `Понял, ориентир по сроку: ${facts.deadline}.`;
  }

  const normalized = userMessage?.toLocaleLowerCase("ru") ?? "";

  if (hasAny(normalized, ["не знаю", "хз", "без понятия", "любой", "любая"])) {
    return "Ок, тогда не будем гадать.";
  }

  return "Понял, продолжим от текущего профиля.";
}

function buildSlotMiniUsefulness(memory: StudentMemory, leadProfile: LeadProfile) {
  const country = primaryCountry(memory, leadProfile);
  const countryIn = countryLocative(country);
  const level = displayLevel(primaryLevel(memory, leadProfile));

  if (country === "Турция" && primaryLevel(memory, leadProfile) === "bachelor") {
    return "Мини-ориентир: для бакалавриата в Турции важно заранее понять тип вуза (гос/частный), язык обучения и годовой бюджет; по документам обычно смотрят аттестат/оценки и требования конкретной программы.";
  }

  if (countryIn && level) {
    return `Мини-ориентир: для сценария "${level} в ${countryIn}" сначала проверяем академические документы, язык обучения, бюджет и дедлайны программ.`;
  }

  if (countryIn) {
    return `Мини-ориентир: по ${countryIn} быстрее всего сузить варианты через уровень, язык обучения, бюджет и направление.`;
  }

  if (level) {
    return `Мини-ориентир: для уровня "${level}" страну лучше выбирать по бюджету, языку, направлению и срокам подачи.`;
  }

  return "";
}

/*
Scenario checks for the slot-filling flow:
- "В какую страну лучше поступать?" -> ask for country/budget/language, no profile reset.
- "В Турцию" -> remember Turkey and ask level + key missing slots.
- "На бакалавриат" -> confirm bachelor in Turkey, ask direction/language/budget.
- "На английском" -> save language and continue with remaining slots.
- "Бюджет 10к" -> save budget and move toward shortlist/deadline details.
*/
function buildContextualContinuationAnswer(
  intent: AdmissionIntent,
  userMessage: string,
  memory: StudentMemory,
  leadProfile: LeadProfile,
) {
  const latestFacts = extractMessageFacts(userMessage);
  const latestFactCount = factCount(latestFacts);
  const knownFactText = knownProfileFacts(memory, leadProfile);
  const hasKnownContext = profileFactCount(memory, leadProfile) > 0;
  const isGeneralContinuation =
    intent === "general" && !isCasualGeneralMessage(userMessage, intent);
  const isWeakContinuation =
    latestFactCount === 0 &&
    hasKnownContext &&
    isWeakContinuationMessage(userMessage);

  if (
    !hasKnownContext ||
    isDirectInfoQuestion(userMessage, intent) ||
    (latestFactCount === 0 && !isGeneralContinuation && !isWeakContinuation)
  ) {
    return "";
  }

  const askLine = buildMissingSlotPrompt(memory, leadProfile);

  return [
    buildAcknowledgement(latestFacts, memory, leadProfile, userMessage),
    knownFactText ? `По текущему профилю: ${knownFactText}.` : "",
    buildSlotMiniUsefulness(memory, leadProfile),
    askLine,
  ]
    .filter(Boolean)
    .join("\n");
}

function isWeakModelAnswer(
  answer: string,
  memory: StudentMemory,
  leadProfile: LeadProfile,
) {
  const normalized = answer.toLocaleLowerCase("ru");
  const hasContext = profileFactCount(memory, leadProfile) > 0;
  const bannedSignals = [
    "я помогу с поступлением за границу",
    "начнем с короткой диагностики",
    "начнём с короткой диагностики",
    "напишите любые 1-2",
    "могу сравнить страны",
    "пример хорошего вопроса",
    "можем спокойно разобрать поступление",
    "i can help with studying abroad",
    "example of a good question",
  ];

  if (!answer.trim() || bannedSignals.some((signal) => normalized.includes(signal))) {
    return true;
  }

  if (!hasContext) {
    return answer.trim().length < 18;
  }

  const knownCountry = primaryCountry(memory, leadProfile)?.toLocaleLowerCase("ru");
  const knownLevel = displayLevel(primaryLevel(memory, leadProfile))?.toLocaleLowerCase("ru");
  const asksKnownCountry =
    knownCountry &&
    /(?:какая|какую|выберите|укажите|напишите).{0,30}стран/.test(normalized);
  const asksKnownLevel =
    knownLevel &&
    /(?:какой|выберите|укажите|напишите).{0,30}(?:уровень|бакалавр|магистр|foundation)/.test(
      normalized,
    );
  const broadDiagnosticFields = [
    "уровень",
    "стран",
    "направ",
    "язык",
    "бюджет",
    "intake",
    "срок",
    "gpa",
  ].filter((signal) => normalized.includes(signal));

  return Boolean(
    asksKnownCountry || asksKnownLevel || broadDiagnosticFields.length >= 5,
  );
}

function memoryPrompt(memory: StudentMemory, leadProfile?: LeadProfile) {
  if (!memory.summary) {
    return "Профиль пока почти пустой.";
  }

  const profileParts = [
    memory.summary,
    leadProfile?.gpa && `GPA/оценки: ${leadProfile.gpa}`,
    leadProfile?.countryOfResidence && `страна проживания: ${leadProfile.countryOfResidence}`,
  ].filter(Boolean);

  return `Учитываю ваш профиль: ${profileParts.join("; ")}.`;
}

function missingProfilePrompt(memory: StudentMemory, leadProfile: LeadProfile) {
  return buildMissingSlotPrompt(memory, leadProfile);
}

function chunkFacts(
  chunks: KnowledgeChunk[],
  options: { limit?: number; skipIds?: string[] } = {},
) {
  const skipIds = new Set(options.skipIds ?? []);
  const facts = uniqueStrings(
    chunks
      .filter((chunk) => !skipIds.has(chunk.id))
      .flatMap((chunk) => chunk.content),
  );

  return facts.slice(0, options.limit ?? 3);
}

function knowledgeBlock(
  chunks: KnowledgeChunk[],
  options: { limit?: number; skipIds?: string[] } = {},
) {
  const facts = chunkFacts(chunks, options);

  if (facts.length === 0) {
    return "";
  }

  return ["Полезные детали:", compactList(facts, facts.length)].join("\n");
}

function hasAny(text: string, signals: string[]) {
  return signals.some((signal) => text.includes(signal));
}

function hasQuestionSignal(text: string) {
  return (
    text.includes("?") ||
    hasAny(text, [
      "сколько",
      "скок",
      "какие",
      "какой",
      "какая",
      "как ",
      "когда",
      "нужн",
      "можно",
      "хватит",
      "что делать",
      "куда",
    ])
  );
}

function isDirectInfoQuestion(userMessage: string, intent: AdmissionIntent) {
  const directIntents: AdmissionIntent[] = [
    "documents",
    "language_test",
    "pricing",
    "deadlines",
    "visa",
    "universities",
    "process",
    "services",
    "contact",
  ];

  return (
    directIntents.includes(intent) &&
    hasQuestionSignal(normalizeForScope(userMessage))
  );
}

function isWeakContinuationMessage(userMessage: string) {
  const normalized = normalizeForScope(userMessage);

  return (
    normalized.length <= 30 &&
    (hasAny(normalized, [
      "хз",
      "не знаю",
      "без понятия",
      "любой",
      "любая",
      "неважно",
      "как-нибудь",
      "что-нибудь",
    ]) ||
      /^[аa]+г?[аa]*$/.test(normalized))
  );
}

function hasCasualSignal(text: string, signals: string[]) {
  const words = text.split(" ");

  return signals.some((signal) =>
    signal.length <= 3 ? words.includes(signal) : text.includes(signal),
  );
}

function hasGreetingSignal(text: string) {
  return (
    hasCasualSignal(text, [
      "привет",
      "приветик",
      "здравствуй",
      "здравствуйте",
      "добрый день",
      "добрый вечер",
      "доброе утро",
      "hello",
      "hi",
      "hey",
    ]) ||
    /(^|\s)пр[еи]ве+т(?:ик)?(\s|$)/.test(text)
  );
}

function isCasualGeneralMessage(userMessage: string, intent: AdmissionIntent) {
  if (intent !== "general") {
    return false;
  }

  const normalized = userMessage
    .toLocaleLowerCase("ru")
    .replace(/[!?.,;:()[\]{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return false;
  }

  const casualSignals = [
    "как дела",
    "как ты",
    "как у тебя дела",
    "спасибо",
    "thanks",
    "thank you",
  ];
  const admissionSignals = [
    "поступ",
    "университет",
    "универ",
    "вуз",
    "стран",
    "программ",
    "документ",
    "ielts",
    "toefl",
    "duolingo",
    "дедлайн",
    "deadline",
    "стоим",
    "бюджет",
    "виз",
    "visa",
    "заяв",
    "консультац",
    "магистр",
    "бакалавр",
    "master",
    "bachelor",
  ];

  return (
    (hasGreetingSignal(normalized) || hasCasualSignal(normalized, casualSignals)) &&
    !hasAny(normalized, admissionSignals) &&
    normalized.length <= 120
  );
}

function buildCasualAnswer(userMessage: string) {
  const normalized = userMessage.toLocaleLowerCase("ru");

  if (hasAny(normalized, ["спасибо", "thanks", "thank you"])) {
    return [
      "Пожалуйста, рад помочь.",
      "Продолжим с текущего вопроса или переключимся на документы, бюджет, IELTS, дедлайны.",
    ].join("\n");
  }

  if (hasAny(normalized, ["как дела", "как ты", "как у тебя дела"])) {
    return [
      "Привет! Все хорошо, я на связи.",
      "У вас уже есть страна/направление или пока присматриваетесь?",
    ].join("\n");
  }

  return [
    "Привет! Я на связи.",
    "Что сейчас важнее понять: страну, документы, бюджет или дедлайны?",
  ].join("\n");
}

function documentListFor(memory: StudentMemory, normalizedMessage: string) {
  if (
    hasAny(normalizedMessage, [
      "виза",
      "visa",
      "cas",
      "i-20",
      "proof of funds",
    ])
  ) {
    return documentChecklists.visa;
  }

  if (
    hasAny(normalizedMessage, [
      "стипенд",
      "грант",
      "scholarship",
      "financial aid",
      "dsu",
    ])
  ) {
    return documentChecklists.scholarship;
  }

  if (memory.level === "master" || hasAny(normalizedMessage, ["магистр", "master"])) {
    return documentChecklists.master;
  }

  return documentChecklists.bachelor;
}

function countrySnapshot(memory: StudentMemory) {
  const selected =
    memory.countries && memory.countries.length > 0
      ? countries.filter((country) => memory.countries?.includes(country.name))
      : countries.slice(0, 4);

  return selected
    .slice(0, 4)
    .map(
      (country) =>
        `- ${country.name}: ${country.bestFor.slice(0, 2).join(", ")}; tuition ${country.tuition}; язык: ${country.language}; риск: ${country.notes[0]}.`,
    )
    .join("\n");
}

function countryCostContext(memory: StudentMemory, leadProfile: LeadProfile) {
  const countryName = primaryCountry(memory, leadProfile);
  const country = countries.find((item) => item.name === countryName);

  if (!country) {
    return "";
  }

  const countryIn = countryLocative(country.name) ?? country.name;
  const budget = memory.budget ?? leadProfile.budget;
  const budgetNote = budget
    ? `Ваш ориентир ${budget} нужно сверить с конкретной программой, городом и депозитами.`
    : "Точный бюджет нужно сверять по программе, городу и депозитам.";

  return `По ${countryIn}: tuition ${country.tuition}, проживание ${country.livingCost}. ${budgetNote}`;
}

function buildAnswer(
  intent: AdmissionIntent,
  userMessage: string,
  memory: StudentMemory,
  leadProfile: LeadProfile,
  chunks: KnowledgeChunk[],
  handoff: boolean,
) {
  const normalizedMessage = userMessage.toLocaleLowerCase("ru");
  const contextIntro = memoryPrompt(memory, leadProfile);
  const missingPrompt = missingProfilePrompt(memory, leadProfile);
  const contextualContinuation = buildContextualContinuationAnswer(
    intent,
    userMessage,
    memory,
    leadProfile,
  );

  if (contextualContinuation) {
    return contextualContinuation;
  }

  switch (intent) {
    case "documents": {
      const documentList = documentListFor(memory, normalizedMessage);
      const wantsSpecialDocumentContext = hasAny(normalizedMessage, [
        "виза",
        "visa",
        "стипенд",
        "грант",
        "scholarship",
        "портфолио",
        "sop",
        "cv",
      ]);
      const qualityFacts = wantsSpecialDocumentContext
        ? knowledgeBlock(chunks, {
            limit: 3,
            skipIds: ["documents-core"],
          })
        : "";

      return [
        "Базовый пакет зависит от уровня, страны и программы. Для первичной проверки смотрим:",
        compactList(documentList, 7),
        "Отдельно проверяются переводы, заверения, формат файлов, дедлайны рекомендаций и требования к SOP/CV/портфолио.",
        qualityFacts,
        missingPrompt,
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "country_fit":
      if (!memory.countries?.length && !leadProfile.targetCountries?.length) {
        return [
          "Зависит от бюджета, языка обучения, направления и сроков.",
          "Быстрый ориентир: Германия и Италия часто сильнее по бюджету; Нидерланды, UK, Канада и США обычно удобнее для англоязычных программ, но дороже.",
          "Какая страна или регион сейчас ближе всего?",
        ].join("\n");
      }

      return [
        "Страну лучше выбирать не по популярности, а по бюджету, языку, срокам, визовым рискам и цели после учебы:",
        countrySnapshot(memory),
        contextIntro,
        knowledgeBlock(chunks, {
          limit: 3,
          skipIds: ["country-fit-core"],
        }),
        missingPrompt,
      ]
        .filter(Boolean)
        .join("\n");

    case "language_test":
      return [
        "IELTS нужен не всегда: университет может принять TOEFL, Duolingo, PTE, internal test или waiver.",
        "Ориентир: bachelor 6.0-6.5, master 6.5-7.0, но точный балл зависит от программы и иногда от визовой логики.",
        "Waiver обычно возможен, если прошлое обучение было на английском, но его нельзя обещать без политики конкретного вуза.",
        knowledgeBlock(chunks, {
          limit: 2,
          skipIds: ["language-tests-core"],
        }),
        missingPrompt,
      ]
        .filter(Boolean)
        .join("\n");

    case "pricing":
      {
        const countryCost = countryCostContext(memory, leadProfile);
        const wantsScholarshipContext = hasAny(normalizedMessage, [
          "стипенд",
          "грант",
          "scholarship",
          "financial aid",
        ]);

        return [
          "Бюджет считается не только из tuition: добавляем жилье, питание, депозит, визу, страховку, переводы, экзамены, application fees и резерв.",
          countryCost ||
            "Ориентиры: Европа 2 000-18 000 EUR/год, Канада 16 000-35 000 CAD/год, UK 14 000-35 000 GBP/год, США часто 20 000-60 000 USD/год.",
          "Для стипендий отдельно проверяем тип: merit-based, need-based, university discount или external fund.",
          wantsScholarshipContext
            ? knowledgeBlock(chunks, {
                limit: 3,
                skipIds: ["pricing-core"],
              })
            : "",
          missingPrompt,
        ]
          .filter(Boolean)
          .join("\n");
      }

    case "deadlines":
      return [
        "Безопасно начинать за 9-12 месяцев до intake, а для стипендий и топовых программ - за 12-15 месяцев.",
        "Типовая логика: сначала страна/бюджет/язык, затем shortlist, документы, заявки, offer, депозит, виза и pre-departure.",
        "Дедлайны отличаются по стране, университету, программе и scholarship window.",
        handoff
          ? "Если до дедлайна меньше 30 дней, лучше сразу подключить менеджера: нужно быстро проверить реалистичность подачи."
          : "",
        knowledgeBlock(chunks, {
          limit: 3,
          skipIds: ["deadlines-core"],
        }),
        missingPrompt,
      ]
        .filter(Boolean)
        .join("\n");

    case "visa":
      return [
        "По визе могу дать только общий ориентир: обычно нужны admission/CAS/I-20/equivalent, паспорт, proof of funds, страховка, анкета, сборы и биометрия или интервью.",
        "Точные требования зависят от страны, консульства, паспорта, финансовой истории и учебной логики.",
        "Если есть отказ, gap year, спорные финансы, несовершеннолетний студент или срочные сроки, нужен менеджер.",
        knowledgeBlock(chunks, {
          limit: 3,
          skipIds: ["visa-core"],
        }),
        missingPrompt,
      ]
        .filter(Boolean)
        .join("\n");

    case "universities":
      return [
        "Shortlist лучше строить из safety, target и reach программ.",
        "Проверяются GPA/оценки, prerequisites, язык, бюджет, дедлайны, портфолио/эссе и визовая логика.",
        "По рейтингу одному выбирать рискованно: важны требования программы, город, career outcome и реалистичность подачи.",
        knowledgeBlock(chunks, {
          limit: 3,
          skipIds: ["universities-core"],
        }),
        missingPrompt,
      ]
        .filter(Boolean)
        .join("\n");

    case "process":
      return [
        "Типовой процесс: профиль -> выбор стран -> shortlist -> документы -> заявки -> offers -> депозит -> виза -> pre-departure.",
        "Сначала фиксируем профиль, затем делим задачи на документы, экзамены, дедлайны, бюджет и риски.",
        "После offer проверяем условия, депозит, финансы, визу, жилье, страховку и arrival steps.",
        knowledgeBlock(chunks, {
          limit: 3,
          skipIds: ["process-core"],
        }),
        missingPrompt,
      ]
        .filter(Boolean)
        .join("\n");

    case "application_start":
      {
        const knownFacts = knownProfileFacts(memory, leadProfile);
        const nextQuestion = buildSingleNextQuestion(memory, leadProfile);

        return [
          "Ок, зафиксировал старт.",
          knownFacts ? `Уже есть: ${knownFacts}.` : "",
          leadProfile.riskFactors?.length
            ? `Вижу риск-факторы: ${leadProfile.riskFactors.join(", ")}. Их лучше сразу показать менеджеру.`
            : "Если есть gap year, отказ в визе, низкий GPA или срочный дедлайн, это важно знать заранее.",
          nextQuestion
            ? `Следующий полезный шаг: ${nextQuestion}`
            : "Данных достаточно для первичного маршрута; дальше можно сверять программы, дедлайны и документы.",
        ]
          .filter(Boolean)
          .join("\n");
      }

    case "complex_case":
      return [
        "Это похоже на индивидуальный случай, здесь лучше не угадывать.",
        "Менеджеру нужны: страна проживания, уровень, оценки/GPA, направление, бюджет, желаемый intake и что именно усложняет ситуацию.",
        "Я могу дать общий ориентир, но решение по шансам, визе, дедлайнам и стратегии лучше делать после разбора документов.",
        knowledgeBlock(chunks, {
          limit: 3,
          skipIds: ["complex-case-core"],
        }),
      ]
        .filter(Boolean)
        .join("\n");

    case "services":
      return [
        "Atlas помогает с диагностикой, подбором стран и программ, документами, заявками, стипендиями, визой и pre-departure.",
        compactList(services.map((service) => `${service.title}: ${service.summary}`), 6),
        "Если цель уже понятна, менеджеру будет полезнее всего сразу увидеть страну, уровень и направление.",
      ]
        .filter(Boolean)
        .join("\n");

    case "contact":
      return [
        `Связаться с Atlas можно через форму консультации, email ${companyContacts.email} или Instagram.`,
        `Вот ссылка на Instagram: ${companyContacts.instagram}`,
        "Чтобы менеджер ответил быстрее, добавьте хотя бы страну, уровень и направление.",
        knowledgeBlock(chunks, {
          limit: 2,
          skipIds: ["company-core"],
        }),
      ]
        .filter(Boolean)
        .join("\n");

    case "general":
    default:
      if (isCasualGeneralMessage(userMessage, intent)) {
        return buildCasualAnswer(userMessage);
      }

      if (
        normalizedMessage.includes("ты ии") ||
        normalizedMessage.includes("ты ai") ||
        normalizedMessage.includes("ты бот") ||
        normalizedMessage.includes("кто ты")
      ) {
        return [
          `Да, я ${productBrand.assistantName} - AI-ассистент ${productBrand.companyShortName}.`,
          "Отвечаю по странам, программам, документам, IELTS, бюджету, дедлайнам и общему визовому чеклисту.",
          "Для индивидуальных рисков передаю контекст менеджеру, чтобы не угадывать.",
        ].join("\n");
      }

      if (handoff) {
        return [
          "Похоже, вопрос требует индивидуальной проверки.",
          "Я не буду выдумывать ответ без данных. Лучше передать менеджеру и приложить уровень, страну, бюджет, сроки и проблему.",
          knowledgeBlock(chunks, {
            limit: 2,
          }),
        ]
          .filter(Boolean)
          .join("\n");
      }

      return [
        "Не до конца понял формулировку, но попробую сузить.",
        "Если речь про поступление, самый полезный первый фильтр - страна или регион.",
        buildMissingSlotPrompt(memory, leadProfile),
      ]
        .filter(Boolean)
        .join("\n");
  }
}

export function buildPromptPayload(
  userMessage: string,
  intent: AdmissionIntent,
  memory: StudentMemory,
  leadProfile: LeadProfile,
  chunks: KnowledgeChunk[],
) {
  return {
    system: ADMISSIONS_SYSTEM_PROMPT,
    user: userMessage,
    intent,
    knownFacts: knownProfileFacts(memory, leadProfile),
    missingSlots: buildNextQuestionFromMissingSlots(memory, leadProfile),
    memorySummary: memory.summary ?? null,
    leadProfile,
    retrievedContext: compactContext(chunks),
  };
}

function geminiMode(): GeminiMode {
  const rawMode = (process.env.GEMINI_MODE ?? "complex").toLocaleLowerCase("en");

  if (rawMode === "off" || rawMode === "never") {
    return "off";
  }

  if (rawMode === "simple") {
    return "simple";
  }

  return "complex";
}

function isGeminiStreamingEnabled() {
  return process.env.GEMINI_STREAMING === "true";
}

function shortLogValue(value: string, limit = 140) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function shouldUseGeminiForTurn(
  routerResult: LocalRouterResult,
  intent: AdmissionIntent,
  confidence: number,
  handoff: boolean,
  scopeIssue?: ScopeIssue,
) {
  const mode = geminiMode();

  if (!hasGeminiConfig() || scopeIssue) {
    return false;
  }

  if (isGeminiTemporarilyUnavailable()) {
    return false;
  }

  if (mode === "off") {
    return false;
  }

  if (
    [
      "greeting",
      "thanks",
      "goodbye",
      "small_talk",
      "yes_no_answer",
      "chip_selection",
      "human_handoff_request",
      "unclear_short_message",
    ].includes(routerResult.intent)
  ) {
    return false;
  }

  if (routerResult.confidence >= 0.75 && !routerResult.isComplex) {
    return false;
  }

  if (routerResult.confidence >= 0.45 && !routerResult.isComplex) {
    return false;
  }

  if (mode === "simple") {
    return routerResult.intent === "complex_question" && routerResult.isComplex;
  }

  return Boolean(
    routerResult.shouldUseGemini ||
      (routerResult.intent === "complex_question" && routerResult.isComplex) ||
      (routerResult.isComplex && routerResult.confidence < 0.9) ||
      (intent === "complex_case" && !handoff) ||
      (confidence < 0.45 && !routerResult.isShort),
  );
}

function topicClarification(topic: LocalRouterTopic) {
  switch (topic) {
    case "courses":
      return "Давайте сузим: нужна страна, программа, университет или уровень обучения?";
    case "price":
      return "Хотите узнать общий бюджет, стоимость по стране, стипендии или расходы на подачу?";
    case "schedule":
      return "Вас интересуют дедлайны, когда начинать или план по месяцам?";
    case "teacher":
      return "Уточните, пожалуйста: хотите понять, кто сопровождает, как проходит работа или когда подключается менеджер?";
    case "application":
      return "Хотите оставить заявку сейчас или сначала собрать данные для менеджера?";
    case "contact":
      return "Нужен email, Instagram или форма консультации?";
    case "documents":
      return "По документам уточните уровень: бакалавриат, магистратура или виза?";
    case "language_test":
      return "Что именно по языку: нужен ли IELTS, какой балл или можно ли без теста?";
    case "countries":
      return "Подбираем страну по бюджету, языку, направлению или визовым рискам?";
    case "visa":
      return "По визе уточните страну и ситуацию: обычная подача, proof of funds или был отказ?";
    case "process":
      return "Разобрать общий процесс, план по месяцам или следующий шаг по вашему профилю?";
    case "services":
      return "Уточните, что важно: услуги, стоимость сопровождения, документы или консультация?";
    default:
      return "Уточните, пожалуйста, что вас интересует: страны, стоимость, документы, дедлайны или заявка?";
  }
}

function buildRouterAnswerOverride(
  routerResult: LocalRouterResult,
  previousMemory: StudentMemory | undefined,
) {
  switch (routerResult.intent) {
    case "greeting":
      return [
        "Привет! Я на связи.",
        "Что сейчас важнее понять: страны, стоимость, документы или дедлайны?",
      ].join("\n");
    case "thanks":
      return [
        "Пожалуйста, рад помочь.",
        "Можем продолжить текущую тему или быстро перейти к стоимости, документам, дедлайнам или заявке.",
      ].join("\n");
    case "goodbye":
      return "Хорошо, буду на связи. Когда решите продолжить, напишите страну, уровень обучения или вопрос по документам.";
    case "small_talk":
      return [
        "Все хорошо, я на связи.",
        "Если вернуться к поступлению: вы уже выбрали страну или пока сравниваете варианты?",
      ].join("\n");
    case "human_handoff_request":
      return [
        "Да, можно передать вопрос менеджеру.",
        "Чтобы он быстрее включился, оставьте заявку и добавьте страну, уровень обучения, направление, бюджет и срочность.",
      ].join("\n");
    case "unclear_short_message":
      return topicClarification(routerResult.topic);
    case "yes_no_answer":
      if (previousMemory?.lastBotQuestion) {
        if (routerResult.reason === "contextual_no_answer") {
          return [
            "Ок, тогда сменим фокус.",
            "Что разобрать вместо этого: страны, стоимость, документы, дедлайны или заявку?",
          ].join("\n");
        }

        return [
          "Отлично, продолжим.",
          topicClarification(routerResult.topic),
        ].join("\n");
      }

      return [
        "Понял.",
        "Уточните, пожалуйста, что именно хотите сделать: подобрать страну, узнать стоимость, проверить документы или оставить заявку?",
      ].join("\n");
    case "chip_selection":
      return [
        `Ок, продолжаем тему "${localRouterTopicLabel(routerResult.topic)}".`,
        topicClarification(routerResult.topic),
      ].join("\n");
    default:
      return "";
  }
}

function extractLastQuestion(answer: string) {
  const questions = answer
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("?"));

  return questions.at(-1)?.slice(0, 240);
}

function normalizeRepeatText(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .replace(/[!?.,;:()[\]{}"«»'`~@#$%^&*_+=|\\/<>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function answerSimilarity(first: string, second: string) {
  const firstWords = new Set(normalizeRepeatText(first).split(" ").filter(Boolean));
  const secondWords = new Set(normalizeRepeatText(second).split(" ").filter(Boolean));

  if (firstWords.size === 0 || secondWords.size === 0) {
    return 0;
  }

  const intersection = [...firstWords].filter((word) => secondWords.has(word)).length;
  const union = new Set([...firstWords, ...secondWords]).size;

  return intersection / union;
}

function sameChips(first: string[] = [], second: string[] = []) {
  if (first.length === 0 || second.length === 0 || first.length !== second.length) {
    return false;
  }

  return first
    .map(normalizeRepeatText)
    .every((chip, index) => chip === normalizeRepeatText(second[index]));
}

function isRepeatedReply(reply: BotReply, previousMemory?: StudentMemory) {
  if (!previousMemory?.lastBotAnswer) {
    return false;
  }

  const sameIntent =
    previousMemory.lastIntent === reply.intent ||
    previousMemory.lastBotIntent === reply.intent;
  const similarAnswer = answerSimilarity(reply.answer, previousMemory.lastBotAnswer) >= 0.78;
  const repeatedQuestion =
    Boolean(previousMemory.lastBotQuestion) &&
    previousMemory.lastBotQuestion === extractLastQuestion(reply.answer);

  return Boolean(
    similarAnswer ||
      (sameIntent && sameChips(reply.chips, previousMemory.lastSuggestedChips)) ||
      (sameIntent && repeatedQuestion),
  );
}

function advanceRepeatedReply(
  reply: BotReply,
  routerResult: LocalRouterResult,
  previousMemory?: StudentMemory,
) {
  const repeatCount = previousMemory?.repeatedCount ?? 0;
  const topic = routerResult.topic;
  const chips =
    repeatCount >= 1
      ? ["Выбрать страну", "Посчитать бюджет", "Проверить документы", "Связаться"]
      : localRouterTopicChips(topic).slice(0, 4);
  const answer =
    repeatCount >= 1
      ? "Хорошо, начнем с простого: выберите один следующий шаг, а я продолжу без повторов."
      : topic === "unknown"
        ? "Давайте сузим выбор: выберите один пункт, и я сразу перейду к конкретному следующему шагу."
        : `Давайте конкретнее по теме "${localRouterTopicLabel(topic)}": выберите ближайший вариант, и я продолжу от него.`;

  console.info("[chat-repeat] repeated=true action=advance_clarification");

  return {
    ...reply,
    answer,
    chips,
    repeatedAnswerDetected: true,
  };
}

function updateConversationMemory(
  memory: StudentMemory,
  userMessage: string,
  reply: BotReply,
  routerResult: LocalRouterResult,
  repeated: boolean,
  previousMemory?: StudentMemory,
) {
  const lastBotQuestion = extractLastQuestion(reply.answer);
  const selectedCourse =
    routerResult.topic === "courses" &&
    ["chip_selection", "course_question"].includes(routerResult.intent)
      ? userMessage.trim().slice(0, 120)
      : previousMemory?.selectedCourse;
  const userGoal =
    routerResult.topic !== "unknown"
      ? localRouterTopicLabel(routerResult.topic)
      : previousMemory?.userGoal;

  return {
    ...memory,
    lastUserMessage: userMessage.trim().slice(0, 600),
    lastBotAnswer: reply.answer.trim().slice(0, 1200),
    lastBotIntent: routerResult.intent,
    lastBotQuestion,
    lastSuggestedChips: reply.chips.slice(0, 6),
    lastTopic: routerResult.topic,
    selectedCourse,
    userGoal,
    unansweredQuestion: lastBotQuestion,
    repeatedCount: repeated ? (previousMemory?.repeatedCount ?? 0) + 1 : 0,
  };
}

function finalizeReply(
  turn: ChatTurn,
  draftReply: BotReply,
  options: {
    fallbackReason?: string;
    usedGemini: boolean;
  },
) {
  const repeated = isRepeatedReply(draftReply, turn.previousMemory);
  const adjustedReply = repeated
    ? advanceRepeatedReply(draftReply, turn.routerResult, turn.previousMemory)
    : draftReply;
  const memory = updateConversationMemory(
    adjustedReply.memory,
    turn.userMessage,
    adjustedReply,
    turn.routerResult,
    repeated,
    turn.previousMemory,
  );

  return {
    ...adjustedReply,
    confidence: turn.routerResult.confidence,
    memory,
    topic: turn.routerResult.topic,
    usedGemini: options.usedGemini,
    fallbackReason: options.fallbackReason,
    repeatedAnswerDetected:
      adjustedReply.repeatedAnswerDetected || repeated || undefined,
  };
}

function fallbackReasonFromError(error: unknown) {
  if (error instanceof GeminiRequestError) {
    return `gemini_status_${error.status}`;
  }

  if (error instanceof Error && error.name === "GeminiTimeoutError") {
    return "gemini_timeout";
  }

  if (error instanceof SyntaxError) {
    return "gemini_invalid_json";
  }

  if (error instanceof Error && /json/i.test(error.message)) {
    return "gemini_invalid_json";
  }

  if (error instanceof Error && /empty/i.test(error.message)) {
    return "gemini_empty_response";
  }

  return "gemini_error";
}

function logGeminiFallback(error: unknown) {
  const reason = fallbackReasonFromError(error);

  if (error instanceof GeminiRequestError) {
    const cooldownMs = error.retryAfterMs ?? getGeminiCooldownMs();
    const cooldownNote =
      cooldownMs > 0 ? ` cooldownMs=${Math.ceil(cooldownMs)}` : "";

    console.warn(
      `[gemini] error status=${error.status}${cooldownNote} fallback=local`,
    );
    return reason;
  }

  console.warn(`[gemini] error reason=${reason} fallback=local`, error);
  return reason;
}

function prepareChatTurn(
  userMessage: string,
  previousMemory?: StudentMemory,
  previousLeadProfile?: LeadProfile,
): ChatTurn {
  const turnFacts = extractMessageFacts(userMessage);
  const classifierResult = classifyIntent(
    userMessage,
    previousMemory,
    previousLeadProfile,
  );
  const routerResult = routeMessageLocally(
    userMessage,
    previousMemory,
    previousLeadProfile,
    classifierResult,
  );
  const intentResult = {
    ...classifierResult,
    intent: routerResult.admissionIntent,
    confidence: Math.max(routerResult.confidence, classifierResult.confidence),
    matchedKeywords: uniqueStrings([
      ...classifierResult.matchedKeywords,
      ...routerResult.matchedSignals,
    ]),
    needsHuman:
      classifierResult.needsHuman ||
      routerResult.intent === "human_handoff_request" ||
      routerResult.admissionIntent === "complex_case",
  };
  const memory = updateMemory(previousMemory, userMessage, intentResult.intent);
  const chunks = retrieveKnowledge(intentResult.intent, userMessage, memory);
  const handoff =
    intentResult.needsHuman ||
    chunks.some((chunk) => chunk.requiresHuman) ||
    routerResult.intent === "human_handoff_request";
  const leadProfile = extractLeadProfile(
    previousLeadProfile,
    userMessage,
    memory,
    intentResult.intent,
  );
  const scopeIssue = detectScopeIssue(userMessage);
  const links = uniqueLinks(
    chunks,
    scopeIssue
      ? [
          { label: "Страны", href: "/countries" },
          { label: "Процесс", href: "/process" },
          { label: "Консультация", href: "/consultation" },
        ]
      : [],
  );
  const actions = actionForIntent(intentResult.intent, handoff);
  const routerAnswer = scopeIssue
    ? ""
    : buildRouterAnswerOverride(routerResult, previousMemory);
  const baseAnswer = scopeIssue
    ? buildScopeGuardAnswer(scopeIssue)
    : routerAnswer ||
      buildAnswer(
        intentResult.intent,
        userMessage,
        memory,
        leadProfile,
        chunks,
        handoff,
      );
  const baseChips = scopeIssue
    ? scopeGuardChips(scopeIssue)
    : routerAnswer
      ? localRouterTopicChips(routerResult.topic)
      : chipsForIntent(intentResult.intent);
  const baseReply: BotReply = {
    answer: baseAnswer,
    engine: "local",
    intent: intentResult.intent,
    confidence: routerResult.confidence,
    actions,
    links,
    chips:
      isCasualGeneralMessage(userMessage, intentResult.intent) && !routerAnswer
        ? [
            "Пока выбираю страну",
            "Хочу понять бюджет",
            "Какие документы нужны?",
            "С чего начать?",
          ]
        : baseChips,
    sources: chunks.map((chunk) => chunk.id),
    memory,
    leadProfile,
    handoff,
    topic: routerResult.topic,
    usedGemini: false,
  };
  const useGemini = shouldUseGeminiForTurn(
    routerResult,
    intentResult.intent,
    intentResult.confidence,
    handoff,
    scopeIssue,
  );

  console.info(
    `[chat-router] normalized="${shortLogValue(
      routerResult.normalizedMessage,
    )}" intent=${routerResult.intent} topic=${routerResult.topic} confidence=${routerResult.confidence.toFixed(
      2,
    )} gemini=${useGemini} reason=${routerResult.reason}`,
  );

  return {
    userMessage,
    previousMemory,
    previousLeadProfile,
    turnFacts,
    routerResult,
    intentResult,
    memory,
    chunks,
    handoff,
    leadProfile,
    scopeIssue,
    baseReply,
    useGemini,
  };
}

async function buildGeminiReply(
  turn: ChatTurn,
  askModel: GeminiAskFunction,
) {
  const geminiReply = await askModel({
    userMessage: turn.userMessage,
    intent: turn.intentResult.intent,
    memory: turn.memory,
    leadProfile: turn.leadProfile,
    chunks: turn.chunks,
    handoff: turn.handoff,
    confidence: turn.routerResult.confidence,
  });
  const geminiLeadProfilePatch = {
    ...(geminiReply.leadProfilePatch ?? {}),
    ...(turn.turnFacts.countrySelectionMode === "replace" &&
    turn.turnFacts.countries.length > 0
      ? { targetCountries: turn.turnFacts.countries }
      : {}),
  };
  const geminiLeadProfile = mergeLeadProfile(
    turn.leadProfile,
    geminiLeadProfilePatch,
    {
      excludedTargetCountries: turn.turnFacts.excludedCountries,
      replaceTargetCountries: turn.turnFacts.countrySelectionMode === "replace",
    },
  );
  const geminiHandoff = turn.handoff || Boolean(geminiReply.handoff);
  const acceptsModelAnswer = Boolean(
    geminiReply.answer &&
      !isWeakModelAnswer(geminiReply.answer, turn.memory, geminiLeadProfile),
  );
  const geminiAnswer = acceptsModelAnswer
    ? geminiReply.answer
    : turn.baseReply.answer;

  return finalizeReply(
    turn,
    {
      ...turn.baseReply,
      answer: geminiAnswer,
      engine: acceptsModelAnswer ? "atlas" : "atlas-fallback",
      actions: actionForIntent(turn.intentResult.intent, geminiHandoff),
      chips:
        geminiReply.chips && geminiReply.chips.length > 0
          ? geminiReply.chips
          : turn.baseReply.chips,
      leadProfile: geminiLeadProfile,
      handoff: geminiHandoff,
    },
    {
      fallbackReason: acceptsModelAnswer ? undefined : "weak_gemini_answer",
      usedGemini: acceptsModelAnswer,
    },
  );
}

async function createBotReplyFromTurn(turn: ChatTurn) {
  if (!turn.useGemini) {
    return finalizeReply(turn, turn.baseReply, { usedGemini: false });
  }

  try {
    return await buildGeminiReply(turn, askGemini);
  } catch (error) {
    const fallbackReason = logGeminiFallback(error);

    return finalizeReply(
      turn,
      {
        ...turn.baseReply,
        engine: "atlas-fallback",
      },
      {
        fallbackReason,
        usedGemini: false,
      },
    );
  }
}

export async function createBotReply(
  userMessage: string,
  previousMemory?: StudentMemory,
  previousLeadProfile?: LeadProfile,
): Promise<BotReply> {
  const turn = prepareChatTurn(userMessage, previousMemory, previousLeadProfile);

  return createBotReplyFromTurn(turn);
}

function streamEvent(controller: ReadableStreamDefaultController<Uint8Array>, value: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
}

function streamGeminiReply(turn: ChatTurn) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        try {
          const reply = await buildGeminiReply(turn, (input) =>
            askGeminiStream(input, {
              onAnswerDelta(delta) {
                if (delta) {
                  streamEvent(controller, { text: delta, type: "delta" });
                }
              },
            }),
          );

          streamEvent(controller, { reply, type: "final" });
        } catch (error) {
          const fallbackReason = logGeminiFallback(error);
          const reply = finalizeReply(
            turn,
            {
              ...turn.baseReply,
              engine: "atlas-fallback",
            },
            {
              fallbackReason,
              usedGemini: false,
            },
          );

          streamEvent(controller, { reply, type: "fallback" });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function createBotResponse(
  userMessage: string,
  previousMemory?: StudentMemory,
  previousLeadProfile?: LeadProfile,
) {
  const turn = prepareChatTurn(userMessage, previousMemory, previousLeadProfile);

  if (turn.useGemini && isGeminiStreamingEnabled()) {
    return streamGeminiReply(turn);
  }

  return Response.json(await createBotReplyFromTurn(turn));
}
