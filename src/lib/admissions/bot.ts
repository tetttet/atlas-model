import { classifyIntent, updateMemory } from "./classifier";
import { askGemini, hasGeminiConfig } from "./gemini";
import { ADMISSIONS_SYSTEM_PROMPT } from "./prompt";
import { extractLeadProfile, mergeLeadProfile } from "./profile";
import { compactContext, retrieveKnowledge } from "./retrieval";
import { productBrand } from "./brand";
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
} from "./types";

const defaultChips = [
  "Какие документы нужны?",
  "В какую страну лучше поступать?",
  "Сколько стоит обучение?",
  "Я хочу начать поступление",
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

function memoryPrompt(memory: StudentMemory, leadProfile?: LeadProfile) {
  if (!memory.summary) {
    return "Чтобы точнее подсказать, напишите уровень обучения, страну/страны, бюджет и желаемый intake.";
  }

  const profileParts = [
    memory.summary,
    leadProfile?.gpa && `GPA/оценки: ${leadProfile.gpa}`,
    leadProfile?.countryOfResidence && `страна проживания: ${leadProfile.countryOfResidence}`,
  ].filter(Boolean);

  return `Учитываю ваш профиль: ${profileParts.join("; ")}.`;
}

function missingProfilePrompt(memory: StudentMemory, leadProfile: LeadProfile) {
  const missing = [
    !memory.level && !leadProfile.level
      ? "уровень обучения"
      : undefined,
    !memory.program && !leadProfile.program
      ? "направление"
      : undefined,
    !leadProfile.gpa ? "оценки/GPA" : undefined,
    !memory.budget && !leadProfile.budget ? "бюджет" : undefined,
    !memory.countries?.length && !leadProfile.targetCountries?.length
      ? "2-3 страны"
      : undefined,
    !memory.deadline && !leadProfile.deadline ? "intake/срок" : undefined,
  ].filter(Boolean);

  if (missing.length === 0) {
    return "Данных уже достаточно для первичного маршрута; следующий шаг - сверить конкретные программы и дедлайны.";
  }

  return `Чтобы не гадать, уточните: ${missing.slice(0, 3).join(", ")}.`;
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

function hasCasualSignal(text: string, signals: string[]) {
  const words = text.split(" ");

  return signals.some((signal) =>
    signal.length <= 3 ? words.includes(signal) : text.includes(signal),
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
    "привет",
    "здравствуй",
    "здравствуйте",
    "добрый день",
    "добрый вечер",
    "доброе утро",
    "hello",
    "hi",
    "hey",
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
    hasCasualSignal(normalized, casualSignals) &&
    !hasAny(normalized, admissionSignals) &&
    normalized.length <= 120
  );
}

function buildCasualAnswer(userMessage: string) {
  const normalized = userMessage.toLocaleLowerCase("ru");

  if (hasAny(normalized, ["спасибо", "thanks", "thank you"])) {
    return [
      "Пожалуйста, рад помочь.",
      "Я рядом: можем спокойно разобрать страну, программу, документы, IELTS, бюджет или дедлайны.",
      "Если хотите начать с профиля, напишите уровень обучения, направление и оценки/GPA.",
    ].join("\n");
  }

  if (hasAny(normalized, ["как дела", "как ты", "как у тебя дела"])) {
    return [
      "Привет! У меня все хорошо, спасибо. Я на связи и готов спокойно помочь с поступлением.",
      "А у вас как дела: уже есть страна/направление или пока только присматриваетесь?",
    ].join("\n");
  }

  return [
    "Привет! Я на связи.",
    "Можем спокойно разобрать поступление: страну, программу, документы, IELTS, бюджет или дедлайны.",
    "Уже есть страна/направление или пока только выбираете?",
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

  switch (intent) {
    case "documents": {
      const documentList = documentListFor(memory, normalizedMessage);
      const qualityFacts = knowledgeBlock(chunks, {
        limit: 3,
        skipIds: ["documents-core"],
      });

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
      return [
        "Бюджет считается не только из tuition: добавляем жилье, питание, депозит, визу, страховку, переводы, экзамены, application fees и резерв.",
        "Ориентиры: Европа 2 000-18 000 EUR/год, Канада 16 000-35 000 CAD/год, UK 14 000-35 000 GBP/год, США часто 20 000-60 000 USD/год.",
        "Для стипендий отдельно проверяем тип: merit-based, need-based, university discount или external fund.",
        knowledgeBlock(chunks, {
          limit: 3,
          skipIds: ["pricing-core"],
        }),
        missingPrompt,
      ]
        .filter(Boolean)
        .join("\n");

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
        "Процесс Atlas: диагностика -> выбор стран -> shortlist -> документы -> заявки -> офферы -> депозит -> виза -> pre-departure.",
        "На первом шаге фиксируем профиль, затем делим задачи на документы, экзамены, дедлайны, бюджет и риски.",
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
      return [
        "Отлично, можно начать с короткой диагностики. Нужны данные:",
        "- уровень: bachelor/master/foundation",
        "- направление",
        "- оценки или GPA",
        "- язык/IELTS, если есть",
        "- бюджет",
        "- желаемые страны, страна проживания и intake",
        leadProfile.riskFactors?.length
          ? `Уже вижу риск-факторы: ${leadProfile.riskFactors.join(", ")}. Их лучше сразу передать менеджеру.`
          : "Если есть gap year, отказ, низкий GPA или срочный дедлайн, напишите это сразу.",
        "После этого менеджер сможет собрать маршрут, дедлайны и список документов.",
      ]
        .filter(Boolean)
        .join("\n");

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
        "Если цель уже понятна, можно сразу перейти к консультации; если нет - начнем с бюджета, уровня и направления.",
      ]
        .filter(Boolean)
        .join("\n");

    case "contact":
      return [
        `Связаться с Atlas можно через форму консультации, email ${companyContacts.email} или Instagram.`,
        `Вот ссылка на Instagram: ${companyContacts.instagram}`,
        "Чтобы менеджер ответил быстрее, добавьте уровень, направление, оценки/GPA, страны, бюджет, intake, язык и риск-факторы.",
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
          "Я помогаю быстро разобраться с поступлением за границу и собрать данные для менеджера, если случай индивидуальный.",
          "Можете спросить про страны, документы, IELTS, стоимость, дедлайны или старт поступления.",
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
        "Я помогу с поступлением за границу: страны, программы, документы, IELTS, дедлайны, стоимость, виза и старт заявки.",
        "Могу сравнить страны по бюджету, собрать checklist документов, объяснить IELTS/waiver, подсказать timeline или подготовить данные для менеджера.",
        missingPrompt,
        "Пример хорошего вопроса: 'Магистратура по Data в Германии или Нидерландах, бюджет 15 000 EUR, IELTS 6.5 - с чего начать?'",
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
    memorySummary: memory.summary ?? null,
    leadProfile,
    retrievedContext: compactContext(chunks),
  };
}

function shouldUseGemini(intent: AdmissionIntent, confidence: number, handoff: boolean) {
  const mode = process.env.GEMINI_MODE ?? "always";

  if (!hasGeminiConfig()) {
    return false;
  }

  if (mode === "always") {
    return true;
  }

  return (
    handoff ||
    intent === "complex_case" ||
    intent === "application_start" ||
    confidence < 0.56
  );
}

export async function createBotReply(
  userMessage: string,
  previousMemory?: StudentMemory,
  previousLeadProfile?: LeadProfile,
): Promise<BotReply> {
  const intentResult = classifyIntent(userMessage);
  const memory = updateMemory(previousMemory, userMessage, intentResult.intent);
  const chunks = retrieveKnowledge(intentResult.intent, userMessage, memory);
  const handoff =
    intentResult.needsHuman ||
    chunks.some((chunk) => chunk.requiresHuman) ||
    intentResult.intent === "complex_case";
  const leadProfile = extractLeadProfile(
    previousLeadProfile,
    userMessage,
    memory,
    intentResult.intent,
  );
  const links = uniqueLinks(chunks);
  const actions = actionForIntent(intentResult.intent, handoff);
  const baseAnswer = buildAnswer(
    intentResult.intent,
    userMessage,
    memory,
    leadProfile,
    chunks,
    handoff,
  );
  const baseReply: BotReply = {
    answer: baseAnswer,
    engine: "local",
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    actions,
    links,
    chips: chipsForIntent(intentResult.intent),
    sources: chunks.map((chunk) => chunk.id),
    memory,
    leadProfile,
    handoff,
  };

  if (isCasualGeneralMessage(userMessage, intentResult.intent)) {
    return {
      ...baseReply,
      chips: [
        "Пока выбираю страну",
        "Хочу понять бюджет",
        "Какие документы нужны?",
        "С чего начать?",
      ],
    };
  }

  if (!shouldUseGemini(intentResult.intent, intentResult.confidence, handoff)) {
    return baseReply;
  }

  try {
    const geminiReply = await askGemini({
      userMessage,
      intent: intentResult.intent,
      memory,
      leadProfile,
      chunks,
      handoff,
    });
    const geminiLeadProfile = mergeLeadProfile(
      leadProfile,
      geminiReply.leadProfilePatch ?? {},
    );
    const geminiHandoff = handoff || Boolean(geminiReply.handoff);

    return {
      ...baseReply,
      answer: geminiReply.answer || baseAnswer,
      engine: "atlas",
      actions: actionForIntent(intentResult.intent, geminiHandoff),
      chips:
        geminiReply.chips && geminiReply.chips.length > 0
          ? geminiReply.chips
          : baseReply.chips,
      leadProfile: geminiLeadProfile,
      handoff: geminiHandoff,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Atlas model fallback:", error);
    }

    return {
      ...baseReply,
      engine: "atlas-fallback",
    };
  }
}
