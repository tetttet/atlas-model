import { classifyIntent, updateMemory } from "./classifier";
import { askGemini, hasGeminiConfig } from "./gemini";
import { ADMISSIONS_SYSTEM_PROMPT } from "./prompt";
import { extractLeadProfile, mergeLeadProfile } from "./profile";
import { compactContext, retrieveKnowledge } from "./retrieval";
import { productBrand } from "./brand";
import {
  countries,
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
      "Нужны ли переводы?",
    ],
    country_fit: [
      "Бюджет до 15 000 EUR",
      "Хочу учиться на английском",
      "Сравни Канаду и Европу",
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
    ],
    deadlines: [
      "Дедлайны на осень",
      "Я опаздываю со сроками",
      "Когда начинать?",
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
    ],
    complex_case: [
      "Передать менеджеру",
      "Какие данные нужны?",
      "Записаться на консультацию",
    ],
  };

  return byIntent[intent] ?? defaultChips;
}

function compactList(items: string[], limit = 5) {
  return items.slice(0, limit).map((item) => `- ${item}`).join("\n");
}

function memoryPrompt(memory: StudentMemory) {
  if (!memory.summary) {
    return "Чтобы точнее подсказать, напишите уровень обучения, страну/страны, бюджет и желаемый intake.";
  }

  return `Учитываю ваш профиль: ${memory.summary}.`;
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
        `- ${country.name}: ${country.bestFor.slice(0, 2).join(", ")}; tuition ${country.tuition}.`,
    )
    .join("\n");
}

function buildAnswer(
  intent: AdmissionIntent,
  userMessage: string,
  memory: StudentMemory,
  handoff: boolean,
) {
  const contextIntro = memoryPrompt(memory);
  const normalizedMessage = userMessage.toLocaleLowerCase("ru");

  switch (intent) {
    case "documents":
      return [
        "Базовый пакет зависит от уровня и страны, но обычно нужен такой набор:",
        compactList(documentChecklists.bachelor, 6),
        "Для магистратуры добавляются диплом, приложение с оценками, SOP и 2-3 рекомендации.",
        "Точный список лучше сверять по программе: требования к переводам и заверению отличаются.",
      ].join("\n");

    case "country_fit":
      return [
        "Страну лучше выбирать не по популярности, а по бюджету, языку, срокам, визовым рискам и цели после учебы.",
        countrySnapshot(memory),
        contextIntro,
      ].join("\n");

    case "language_test":
      return [
        "IELTS нужен не всегда, но для англоязычных программ часто требуют IELTS/TOEFL/Duolingo или accepted equivalent.",
        "Ориентир: bachelor 6.0-6.5, master 6.5-7.0, но точный балл зависит от программы.",
        "Иногда возможен waiver, если предыдущее обучение было на английском или университет принимает внутренний тест.",
      ].join("\n");

    case "pricing":
      return [
        "Стоимость считается из tuition, проживания, депозита, визы, страховки, переводов, экзаменов и резерва.",
        "Ориентиры: Европа 2 000-18 000 EUR/год, Канада 16 000-35 000 CAD/год, UK 14 000-35 000 GBP/год, США часто 20 000-60 000 USD/год.",
        "Для точного бюджета нужны страна, уровень, программа и город.",
      ].join("\n");

    case "deadlines":
      return [
        "Безопасно начинать за 9-12 месяцев до intake, а для стипендий и топовых программ - за 12-15 месяцев.",
        "Если до дедлайна меньше 30 дней, лучше сразу подключить менеджера: нужно быстро проверить реалистичность подачи.",
        "Дедлайны отличаются по стране, университету, программе и scholarship window.",
      ].join("\n");

    case "visa":
      return [
        "По визе могу дать только общий ориентир: обычно нужны admission/CAS/I-20/equivalent, паспорт, proof of funds, страховка, анкета, сборы и биометрия или интервью.",
        "Точные требования зависят от страны, консульства и вашей истории.",
        "Если есть отказ, gap year, спорные финансы или срочные сроки, нужен менеджер.",
      ].join("\n");

    case "universities":
      return [
        "Shortlist лучше строить из safety, target и reach программ.",
        "Проверяются требования к оценкам, предметам, языку, бюджету, дедлайнам и визовой логике.",
        "Напишите уровень, направление, GPA/оценки, бюджет и 2-3 страны - соберу первичный маршрут.",
      ].join("\n");

    case "process":
      return [
        "Процесс AtlasPath: диагностика -> выбор стран -> shortlist -> документы -> заявки -> офферы -> депозит -> виза -> pre-departure.",
        "На первом шаге нужны уровень, направление, оценки, язык, бюджет и желаемый intake.",
        "После этого можно собрать план дедлайнов и документов.",
      ].join("\n");

    case "application_start":
      return [
        "Отлично. Чтобы начать поступление, нужны 6 данных:",
        "- уровень: bachelor/master/foundation",
        "- направление",
        "- оценки или GPA",
        "- язык/IELTS, если есть",
        "- бюджет",
        "- желаемые страны и intake",
        "Можно оставить заявку, и менеджер соберет маршрут.",
      ].join("\n");

    case "complex_case":
      return [
        "Это похоже на индивидуальный случай, здесь лучше не угадывать.",
        "Менеджеру нужны: страна проживания, уровень, оценки/GPA, направление, бюджет, желаемый intake и что именно усложняет ситуацию.",
        "Я могу дать общий ориентир, но решение по шансам, визе и дедлайнам лучше делать после разбора документов.",
      ].join("\n");

    case "services":
      return [
        "AtlasPath помогает с диагностикой, подбором стран и программ, документами, заявками, стипендиями, визой и pre-departure.",
        compactList(services.map((service) => `${service.title}: ${service.summary}`), 4),
        "Если цель уже понятна, можно сразу перейти к консультации.",
      ].join("\n");

    case "contact":
      return [
        "Связаться с AtlasPath можно через форму консультации или email admissions@atlaspath.example.",
        "Если вопрос про документы, визу, срочные сроки или шансы, лучше оставить заявку с описанием профиля.",
      ].join("\n");

    case "general":
    default:
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
        ].join("\n");
      }

      return [
        "Я помогу с поступлением за границу: страны, программы, документы, IELTS, дедлайны, стоимость, виза и старт заявки.",
        "Напишите вопрос коротко, например: 'Какие документы нужны для магистратуры в Германии?'",
      ].join("\n");
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
