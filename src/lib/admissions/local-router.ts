import type {
  AdmissionIntent,
  IntentResult,
  LeadProfile,
  StudentMemory,
} from "./types";

export type LocalRouterIntent =
  | "greeting"
  | "thanks"
  | "goodbye"
  | "small_talk"
  | "yes_no_answer"
  | "chip_selection"
  | "faq_like_question"
  | "price_question"
  | "schedule_question"
  | "course_question"
  | "teacher_question"
  | "application_question"
  | "contact_question"
  | "human_handoff_request"
  | "unclear_short_message"
  | "complex_question";

export type LocalRouterTopic =
  | "greeting"
  | "thanks"
  | "goodbye"
  | "small_talk"
  | "price"
  | "schedule"
  | "courses"
  | "teacher"
  | "application"
  | "contact"
  | "documents"
  | "language_test"
  | "countries"
  | "visa"
  | "process"
  | "services"
  | "human"
  | "unknown";

type TopicPattern = {
  topic: LocalRouterTopic;
  intent: LocalRouterIntent;
  admissionIntent: AdmissionIntent;
  keywords: string[];
  synonyms: string[];
  confidenceBoost: number;
};

export type LocalRouterResult = {
  intent: LocalRouterIntent;
  topic: LocalRouterTopic;
  admissionIntent: AdmissionIntent;
  confidence: number;
  shouldUseGemini: boolean;
  reason: string;
  normalizedMessage: string;
  matchedSignals: string[];
  isShort: boolean;
  isComplex: boolean;
};

const TOPIC_PATTERNS: TopicPattern[] = [
  {
    topic: "price",
    intent: "price_question",
    admissionIntent: "pricing",
    keywords: ["цена", "стоимость", "сколько стоит", "оплата", "платно", "тариф"],
    synonyms: [
      "дорого",
      "дешево",
      "дёшево",
      "прайс",
      "оплачивать",
      "бюджет",
      "tuition",
      "грант",
      "стипендия",
      "расходы",
    ],
    confidenceBoost: 0.35,
  },
  {
    topic: "schedule",
    intent: "schedule_question",
    admissionIntent: "deadlines",
    keywords: ["расписание", "время", "когда", "дни", "урок", "занятия"],
    synonyms: [
      "график",
      "по каким дням",
      "во сколько",
      "дедлайн",
      "срок",
      "intake",
      "подача",
      "успеть",
    ],
    confidenceBoost: 0.35,
  },
  {
    topic: "courses",
    intent: "course_question",
    admissionIntent: "universities",
    keywords: ["курс", "курсы", "обучение", "предмет", "занятие"],
    synonyms: [
      "уроки",
      "направление",
      "программа",
      "специальность",
      "университет",
      "вуз",
      "бакалавриат",
      "магистратура",
      "foundation",
    ],
    confidenceBoost: 0.35,
  },
  {
    topic: "teacher",
    intent: "teacher_question",
    admissionIntent: "services",
    keywords: ["преподаватель", "учитель", "наставник", "педагог"],
    synonyms: ["кто ведет", "кто будет учить", "эксперт", "консультант", "менеджер"],
    confidenceBoost: 0.35,
  },
  {
    topic: "application",
    intent: "application_question",
    admissionIntent: "application_start",
    keywords: ["заявка", "записаться", "оставить заявку", "регистрация"],
    synonyms: ["подать", "запись", "начать", "старт", "консультация", "apply"],
    confidenceBoost: 0.35,
  },
  {
    topic: "contact",
    intent: "contact_question",
    admissionIntent: "contact",
    keywords: ["контакт", "связаться", "телефон", "email", "почта"],
    synonyms: ["whatsapp", "instagram", "инстаграм", "инста", "куда писать"],
    confidenceBoost: 0.35,
  },
  {
    topic: "documents",
    intent: "faq_like_question",
    admissionIntent: "documents",
    keywords: ["документ", "документы", "аттестат", "диплом", "паспорт"],
    synonyms: ["sop", "cv", "эссе", "рекомендация", "портфолио", "перевод"],
    confidenceBoost: 0.32,
  },
  {
    topic: "language_test",
    intent: "faq_like_question",
    admissionIntent: "language_test",
    keywords: ["ielts", "toefl", "duolingo", "язык", "английский"],
    synonyms: ["сертификат", "экзамен", "waiver", "pte", "без ielts"],
    confidenceBoost: 0.32,
  },
  {
    topic: "countries",
    intent: "faq_like_question",
    admissionIntent: "country_fit",
    keywords: ["страна", "куда", "канада", "германия", "сша", "турция"],
    synonyms: ["европа", "uk", "италия", "нидерланды", "франция", "испания"],
    confidenceBoost: 0.32,
  },
  {
    topic: "visa",
    intent: "faq_like_question",
    admissionIntent: "visa",
    keywords: ["виза", "visa", "посольство", "консульство"],
    synonyms: ["proof of funds", "банк", "биометрия", "отказ", "cas", "i-20"],
    confidenceBoost: 0.32,
  },
  {
    topic: "process",
    intent: "faq_like_question",
    admissionIntent: "process",
    keywords: ["процесс", "этап", "план", "шаг"],
    synonyms: ["как проходит", "с чего начать", "roadmap", "после offer", "оффер"],
    confidenceBoost: 0.32,
  },
  {
    topic: "services",
    intent: "faq_like_question",
    admissionIntent: "services",
    keywords: ["услуги", "помощь", "сопровождение", "что делаете"],
    synonyms: ["чем помогаете", "что можете", "пакет", "сервис"],
    confidenceBoost: 0.32,
  },
];

const QUESTION_WORDS = [
  "как",
  "что",
  "когда",
  "куда",
  "сколько",
  "можно",
  "какие",
  "какой",
  "какая",
  "почему",
  "зачем",
  "нужно",
  "нужен",
  "подойдет",
  "подойдёт",
  "получится",
];

const GREETING_SIGNALS = [
  "привет",
  "приветик",
  "здравствуйте",
  "здравствуй",
  "добрый день",
  "добрый вечер",
  "доброе утро",
  "hello",
  "hi",
  "hey",
];

const THANKS_SIGNALS = ["спасибо", "благодарю", "thanks", "thank you", "сяп"];
const GOODBYE_SIGNALS = ["пока", "до свидания", "увидимся", "bye", "goodbye"];
const SMALL_TALK_SIGNALS = ["как дела", "как ты", "как настроение", "что нового"];
const YES_SIGNALS = ["да", "ага", "угу", "ок", "окей", "хорошо", "давай", "конечно"];
const NO_SIGNALS = ["нет", "неа", "не", "не хочу", "пока нет", "не надо"];
const HUMAN_HANDOFF_SIGNALS = [
  "менеджер",
  "человек",
  "живой",
  "оператор",
  "консультант",
  "свяжитесь",
  "связаться с менеджером",
  "передайте",
  "передать менеджеру",
  "позвоните",
  "напишите мне",
];
const SHORT_UNCLEAR_PATTERNS = [
  "а как",
  "что там",
  "можно",
  "а если",
  "ну",
  "ок а дальше",
  "и что",
  "хочу",
  "можно узнать",
  "дальше",
  "что дальше",
  "как дальше",
];

export function normalizeRouterMessage(input: string) {
  return input
    .toLocaleLowerCase("ru")
    .replace(/[!?.,;:()[\]{}"«»'`~@#$%^&*_+=|\\/<>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function wordsOf(text: string) {
  return normalizeRouterMessage(text).split(/\s+/).filter(Boolean);
}

function countWords(text: string) {
  return wordsOf(text).length;
}

function hasQuestionWord(text: string) {
  const words = wordsOf(text);
  return text.includes("?") || QUESTION_WORDS.some((word) => words.includes(word));
}

function editDistanceOne(first: string, second: string) {
  if (Math.abs(first.length - second.length) > 1) {
    return false;
  }

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < first.length && j < second.length) {
    if (first[i] === second[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) {
      return false;
    }

    if (first.length > second.length) {
      i += 1;
    } else if (second.length > first.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }

  return true;
}

function matchesSignal(text: string, signal: string) {
  const normalizedSignal = normalizeRouterMessage(signal);

  if (!normalizedSignal) {
    return false;
  }

  if (text.includes(normalizedSignal)) {
    return true;
  }

  const textWords = wordsOf(text);
  const signalWords = wordsOf(normalizedSignal);

  if (signalWords.length > 1) {
    return signalWords.every((signalWord) =>
      textWords.some(
        (word) =>
          word === signalWord ||
          (signalWord.length >= 4 && word.startsWith(signalWord)) ||
          (word.length >= 4 && signalWord.startsWith(word)),
      ),
    );
  }

  const [signalWord] = signalWords;

  return textWords.some((word) => {
    if (word === signalWord) {
      return true;
    }

    if (signalWord.length >= 4 && word.startsWith(signalWord)) {
      return true;
    }

    if (word.length >= 5 && signalWord.length >= 5) {
      return editDistanceOne(word, signalWord);
    }

    return false;
  });
}

function matchedSignals(text: string, signals: string[]) {
  return signals.filter((signal) => matchesSignal(text, signal));
}

function hasAnySignal(text: string, signals: string[]) {
  return matchedSignals(text, signals).length > 0;
}

function hasAdmissionSignal(text: string) {
  return TOPIC_PATTERNS.some((pattern) =>
    hasAnySignal(text, [...pattern.keywords, ...pattern.synonyms]),
  );
}

function admissionIntentTopic(intent?: AdmissionIntent): LocalRouterTopic {
  switch (intent) {
    case "pricing":
      return "price";
    case "deadlines":
      return "schedule";
    case "universities":
      return "courses";
    case "application_start":
      return "application";
    case "contact":
      return "contact";
    case "documents":
      return "documents";
    case "language_test":
      return "language_test";
    case "country_fit":
      return "countries";
    case "visa":
      return "visa";
    case "process":
      return "process";
    case "services":
      return "services";
    default:
      return "unknown";
  }
}

function admissionIntentFromTopic(topic: LocalRouterTopic): AdmissionIntent {
  return (
    TOPIC_PATTERNS.find((pattern) => pattern.topic === topic)?.admissionIntent ??
    "general"
  );
}

function scorePattern(pattern: TopicPattern, normalizedMessage: string) {
  const signals = [...pattern.keywords, ...pattern.synonyms];
  const matched = matchedSignals(normalizedMessage, signals);
  const phraseBonus = matched.some((signal) => normalizeRouterMessage(signal).includes(" "))
    ? 0.08
    : 0;
  const questionBonus = hasQuestionWord(normalizedMessage) ? 0.06 : 0;
  const score =
    matched.length > 0
      ? 0.24 + pattern.confidenceBoost + matched.length * 0.16 + phraseBonus + questionBonus
      : 0;

  return {
    matched,
    score: clampConfidence(score),
  };
}

function bestTopicMatch(normalizedMessage: string) {
  return TOPIC_PATTERNS.map((pattern) => ({
    ...pattern,
    ...scorePattern(pattern, normalizedMessage),
  }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)[0];
}

function inferTopicFromText(text: string, fallback?: LocalRouterTopic) {
  const normalized = normalizeRouterMessage(text);
  const best = bestTopicMatch(normalized);
  return best?.topic ?? fallback ?? "unknown";
}

function inferIntentFromTopic(topic: LocalRouterTopic): LocalRouterIntent {
  return TOPIC_PATTERNS.find((pattern) => pattern.topic === topic)?.intent ?? "faq_like_question";
}

function isOnlyYesNo(normalizedMessage: string) {
  const exactSignals = [...YES_SIGNALS, ...NO_SIGNALS].map(normalizeRouterMessage);

  return exactSignals.includes(normalizedMessage);
}

function hasNoSignal(normalizedMessage: string) {
  return hasAnySignal(normalizedMessage, NO_SIGNALS);
}

function looksLikeChipSelection(
  normalizedMessage: string,
  previousMemory?: StudentMemory,
) {
  if (countWords(normalizedMessage) > 6) {
    return undefined;
  }

  const chips = previousMemory?.lastSuggestedChips ?? [];
  const normalizedChips = chips.map((chip) => ({
    chip,
    normalized: normalizeRouterMessage(chip),
  }));
  const exact = normalizedChips.find(({ normalized }) => normalized === normalizedMessage);

  if (exact) {
    return exact.chip;
  }

  return normalizedChips.find(({ normalized }) => {
    const chipWords = wordsOf(normalized);
    const messageWords = wordsOf(normalizedMessage);
    const overlap = messageWords.filter((word) =>
      chipWords.some((chipWord) => chipWord === word || chipWord.startsWith(word)),
    );

    return messageWords.length > 0 && overlap.length / messageWords.length >= 0.66;
  })?.chip;
}

function looksShortAndUnclear(normalizedMessage: string, bestTopicScore?: number) {
  if (!normalizedMessage) {
    return true;
  }

  if ((bestTopicScore ?? 0) >= 0.6) {
    return false;
  }

  const wordCount = countWords(normalizedMessage);
  const hasGenericShortPattern = SHORT_UNCLEAR_PATTERNS.some((pattern) =>
    normalizedMessage === normalizeRouterMessage(pattern) ||
    normalizedMessage.startsWith(`${normalizeRouterMessage(pattern)} `),
  );
  const hasOnlyWeakQuestion =
    wordCount <= 4 &&
    hasQuestionWord(normalizedMessage) &&
    !hasAdmissionSignal(normalizedMessage);

  return (
    hasGenericShortPattern ||
    hasOnlyWeakQuestion ||
    (wordCount <= 2 && !hasAdmissionSignal(normalizedMessage))
  );
}

function looksComplex(message: string, normalizedMessage: string) {
  const wordCount = countWords(normalizedMessage);
  const questionWordCount = QUESTION_WORDS.filter((word) =>
    wordsOf(normalizedMessage).includes(word),
  ).length;
  const hasPersonalizationSignal = hasAnySignal(normalizedMessage, [
    "мой случай",
    "моя ситуация",
    "персонально",
    "под меня",
    "сравни",
    "объясни подробно",
    "подробно",
    "стратегия",
    "шансы",
    "риск",
    "отказ",
    "gap year",
    "низкий gpa",
  ]);

  return (
    message.length > 180 ||
    wordCount > 24 ||
    (wordCount > 14 && questionWordCount >= 2) ||
    (wordCount > 10 && hasPersonalizationSignal)
  );
}

function result(params: Omit<LocalRouterResult, "confidence"> & { confidence: number }) {
  return {
    ...params,
    confidence: clampConfidence(params.confidence),
  };
}

export function routeMessageLocally(
  message: string,
  previousMemory?: StudentMemory,
  _previousLeadProfile?: LeadProfile,
  classifierResult?: IntentResult,
): LocalRouterResult {
  const normalizedMessage = normalizeRouterMessage(message);
  const isShort = countWords(normalizedMessage) <= 8;
  const best = bestTopicMatch(normalizedMessage);
  const contextTopic =
    previousMemory?.lastTopic && previousMemory.lastTopic !== "unknown"
      ? (previousMemory.lastTopic as LocalRouterTopic)
      : admissionIntentTopic(previousMemory?.lastIntent);
  const isComplex = looksComplex(message, normalizedMessage);
  const classifierTopic = admissionIntentTopic(classifierResult?.intent);
  const classifierConfidence = classifierResult?.confidence ?? 0;

  if (hasAnySignal(normalizedMessage, HUMAN_HANDOFF_SIGNALS)) {
    return result({
      intent: "human_handoff_request",
      topic: "human",
      admissionIntent: "contact",
      confidence: 0.94,
      shouldUseGemini: false,
      reason: "human_handoff_signal",
      normalizedMessage,
      matchedSignals: matchedSignals(normalizedMessage, HUMAN_HANDOFF_SIGNALS),
      isShort,
      isComplex,
    });
  }

  if (
    hasAnySignal(normalizedMessage, GREETING_SIGNALS) &&
    !hasAdmissionSignal(normalizedMessage)
  ) {
    return result({
      intent: "greeting",
      topic: "greeting",
      admissionIntent: "general",
      confidence: 0.92,
      shouldUseGemini: false,
      reason: "casual_greeting",
      normalizedMessage,
      matchedSignals: matchedSignals(normalizedMessage, GREETING_SIGNALS),
      isShort,
      isComplex,
    });
  }

  if (
    hasAnySignal(normalizedMessage, THANKS_SIGNALS) &&
    !hasAdmissionSignal(normalizedMessage)
  ) {
    return result({
      intent: "thanks",
      topic: "thanks",
      admissionIntent: previousMemory?.lastIntent ?? "general",
      confidence: 0.91,
      shouldUseGemini: false,
      reason: "casual_thanks",
      normalizedMessage,
      matchedSignals: matchedSignals(normalizedMessage, THANKS_SIGNALS),
      isShort,
      isComplex,
    });
  }

  if (
    hasAnySignal(normalizedMessage, GOODBYE_SIGNALS) &&
    !hasAdmissionSignal(normalizedMessage)
  ) {
    return result({
      intent: "goodbye",
      topic: "goodbye",
      admissionIntent: "general",
      confidence: 0.9,
      shouldUseGemini: false,
      reason: "casual_goodbye",
      normalizedMessage,
      matchedSignals: matchedSignals(normalizedMessage, GOODBYE_SIGNALS),
      isShort,
      isComplex,
    });
  }

  if (
    hasAnySignal(normalizedMessage, SMALL_TALK_SIGNALS) &&
    !hasAdmissionSignal(normalizedMessage)
  ) {
    return result({
      intent: "small_talk",
      topic: "small_talk",
      admissionIntent: "general",
      confidence: 0.88,
      shouldUseGemini: false,
      reason: "casual_small_talk",
      normalizedMessage,
      matchedSignals: matchedSignals(normalizedMessage, SMALL_TALK_SIGNALS),
      isShort,
      isComplex,
    });
  }

  if (isOnlyYesNo(normalizedMessage)) {
    const topic = contextTopic !== "unknown" ? contextTopic : "unknown";

    return result({
      intent: "yes_no_answer",
      topic,
      admissionIntent: previousMemory?.lastIntent ?? admissionIntentFromTopic(topic),
      confidence: previousMemory?.lastBotQuestion ? 0.72 : 0.58,
      shouldUseGemini: false,
      reason: previousMemory?.lastBotQuestion
        ? hasNoSignal(normalizedMessage)
          ? "contextual_no_answer"
          : "contextual_yes_answer"
        : "short_yes_no_without_question",
      normalizedMessage,
      matchedSignals: matchedSignals(normalizedMessage, [...YES_SIGNALS, ...NO_SIGNALS]),
      isShort,
      isComplex,
    });
  }

  const selectedChip = looksLikeChipSelection(normalizedMessage, previousMemory);

  if (selectedChip) {
    const topic = inferTopicFromText(selectedChip, contextTopic);

    return result({
      intent: "chip_selection",
      topic,
      admissionIntent: admissionIntentFromTopic(topic),
      confidence: 0.86,
      shouldUseGemini: false,
      reason: "matched_previous_chip",
      normalizedMessage,
      matchedSignals: [selectedChip],
      isShort,
      isComplex,
    });
  }

  if (best && best.score >= 0.6 && isComplex && best.score < 0.9) {
    return result({
      intent: "complex_question",
      topic: best.topic,
      admissionIntent: best.admissionIntent,
      confidence: Math.max(0.42, Math.min(best.score, classifierConfidence || best.score)),
      shouldUseGemini: true,
      reason: "complex_topic_question",
      normalizedMessage,
      matchedSignals: best.matched,
      isShort,
      isComplex,
    });
  }

  if (best && best.score >= 0.6) {
    return result({
      intent: best.intent,
      topic: best.topic,
      admissionIntent: best.admissionIntent,
      confidence: Math.max(best.score, classifierConfidence),
      shouldUseGemini: false,
      reason: "topic_match",
      normalizedMessage,
      matchedSignals: best.matched,
      isShort,
      isComplex,
    });
  }

  if (looksShortAndUnclear(normalizedMessage, best?.score)) {
    return result({
      intent: "unclear_short_message",
      topic: contextTopic,
      admissionIntent:
        contextTopic !== "unknown"
          ? admissionIntentFromTopic(contextTopic)
          : previousMemory?.lastIntent ?? "general",
      confidence: previousMemory?.lastBotQuestion ? 0.62 : 0.55,
      shouldUseGemini: false,
      reason: previousMemory?.lastBotQuestion
        ? "short_unclear_contextual_clarification"
        : "short_unclear_clarification",
      normalizedMessage,
      matchedSignals: best?.matched ?? [],
      isShort,
      isComplex,
    });
  }

  if (classifierResult && classifierResult.intent !== "general" && classifierConfidence >= 0.5) {
    return result({
      intent: "faq_like_question",
      topic: classifierTopic,
      admissionIntent: classifierResult.intent,
      confidence: Math.max(0.62, classifierConfidence),
      shouldUseGemini: false,
      reason: "classifier_topic_match",
      normalizedMessage,
      matchedSignals: classifierResult.matchedKeywords,
      isShort,
      isComplex,
    });
  }

  if (isComplex) {
    return result({
      intent: "complex_question",
      topic: classifierTopic,
      admissionIntent:
        classifierResult?.intent && classifierResult.intent !== "general"
          ? classifierResult.intent
          : "complex_case",
      confidence: Math.max(0.4, classifierConfidence),
      shouldUseGemini: true,
      reason: "complex_or_personalized_question",
      normalizedMessage,
      matchedSignals: classifierResult?.matchedKeywords ?? [],
      isShort,
      isComplex,
    });
  }

  if (hasQuestionWord(normalizedMessage) && !isShort) {
    return result({
      intent: "complex_question",
      topic: classifierTopic,
      admissionIntent:
        classifierResult?.intent && classifierResult.intent !== "general"
          ? classifierResult.intent
          : "general",
      confidence: Math.max(0.35, classifierConfidence),
      shouldUseGemini: classifierConfidence < 0.45,
      reason: "low_confidence_open_question",
      normalizedMessage,
      matchedSignals: classifierResult?.matchedKeywords ?? [],
      isShort,
      isComplex,
    });
  }

  return result({
    intent: "unclear_short_message",
    topic: contextTopic,
    admissionIntent:
      contextTopic !== "unknown"
        ? admissionIntentFromTopic(contextTopic)
        : previousMemory?.lastIntent ?? "general",
    confidence: 0.45,
    shouldUseGemini: false,
    reason: "unclear_needs_clarification",
    normalizedMessage,
    matchedSignals: [],
    isShort,
    isComplex,
  });
}

export function localRouterTopicChips(topic: LocalRouterTopic) {
  switch (topic) {
    case "courses":
      return ["Страна", "Программа", "Бакалавриат", "Магистратура"];
    case "price":
      return ["Общая стоимость", "Стипендии", "Бюджет по стране", "Способы оплаты"];
    case "schedule":
      return ["Дедлайны", "Когда начинать", "План по месяцам", "Срочная подача"];
    case "teacher":
      return ["Кто помогает", "Роль менеджера", "Консультация", "Как проходит работа"];
    case "application":
      return ["Оставить заявку", "Какие данные нужны", "Начать с профиля", "Консультация"];
    case "contact":
      return ["Email", "Instagram", "Форма консультации", "Что отправить"];
    default:
      return ["Страны", "Стоимость", "Документы", "Дедлайны", "Заявка"];
  }
}

export function localRouterTopicLabel(topic: LocalRouterTopic) {
  const labels: Record<LocalRouterTopic, string> = {
    greeting: "приветствие",
    thanks: "благодарность",
    goodbye: "завершение",
    small_talk: "короткий диалог",
    price: "стоимость",
    schedule: "сроки",
    courses: "программы",
    teacher: "эксперты",
    application: "заявка",
    contact: "контакты",
    documents: "документы",
    language_test: "языковой тест",
    countries: "страны",
    visa: "виза",
    process: "процесс",
    services: "услуги",
    human: "менеджер",
    unknown: "вопрос",
  };

  return labels[topic];
}

export function routerIntentFromTopic(topic: LocalRouterTopic) {
  return inferIntentFromTopic(topic);
}
