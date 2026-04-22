import { ADMISSIONS_SYSTEM_PROMPT } from "./prompt";
import { productBrand } from "./brand";
import { compactContext } from "./retrieval";
import type {
  AdmissionIntent,
  GeminiStructuredReply,
  KnowledgeChunk,
  LeadProfile,
  StudentMemory,
} from "./types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;
const TRANSIENT_ERROR_COOLDOWN_MS = 10_000;
const MAX_RETRY_AFTER_MS = 10 * 60_000;

let geminiUnavailableUntil = 0;

export class GeminiRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(status: number, retryAfterMs?: number) {
    super(`Model request failed with ${status}.`);
    this.name = "GeminiRequestError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type GeminiInput = {
  userMessage: string;
  intent: AdmissionIntent;
  confidence?: number;
  memory: StudentMemory;
  leadProfile: LeadProfile;
  chunks: KnowledgeChunk[];
  handoff: boolean;
};

function envNumber(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }

  const date = Date.parse(value);

  if (!Number.isNaN(date)) {
    return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
  }

  return undefined;
}

function cooldownForStatus(status: number, retryAfterMs?: number) {
  if (status === 429) {
    return retryAfterMs ?? envNumber(
      "GEMINI_RATE_LIMIT_COOLDOWN_MS",
      DEFAULT_RATE_LIMIT_COOLDOWN_MS,
    );
  }

  if (status >= 500) {
    return retryAfterMs ?? envNumber(
      "GEMINI_TRANSIENT_ERROR_COOLDOWN_MS",
      TRANSIENT_ERROR_COOLDOWN_MS,
    );
  }

  return 0;
}

function markGeminiUnavailable(ms: number) {
  if (ms <= 0) {
    return;
  }

  geminiUnavailableUntil = Math.max(geminiUnavailableUntil, Date.now() + ms);
}

export function getGeminiCooldownMs() {
  return Math.max(0, geminiUnavailableUntil - Date.now());
}

export function isGeminiTemporarilyUnavailable() {
  return getGeminiCooldownMs() > 0;
}

function jsonFromText(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as GeminiStructuredReply;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Model did not return JSON.");
    }

    return JSON.parse(match[0]) as GeminiStructuredReply;
  }
}

function normalizeStructuredReply(value: GeminiStructuredReply) {
  return {
    answer:
      typeof value.answer === "string" && value.answer.trim()
        ? value.answer.trim().slice(0, 1600)
        : "",
    leadProfilePatch:
      typeof value.leadProfilePatch === "object" && value.leadProfilePatch
        ? value.leadProfilePatch
        : {},
    handoff: Boolean(value.handoff),
    chips: Array.isArray(value.chips)
      ? value.chips
          .filter((chip): chip is string => typeof chip === "string")
          .map((chip) => chip.trim())
          .filter(Boolean)
          .slice(0, 4)
      : undefined,
  };
}

function hasKnownProfileFacts(memory: StudentMemory, leadProfile: LeadProfile) {
  return Boolean(
    memory.summary ||
      memory.level ||
      memory.countries?.length ||
      memory.program ||
      memory.language ||
      memory.budget ||
      memory.languageTest ||
      memory.deadline ||
      leadProfile.summary ||
      leadProfile.level ||
      leadProfile.targetCountries?.length ||
      leadProfile.program ||
      leadProfile.language ||
      leadProfile.budget ||
      leadProfile.languageTest ||
      leadProfile.deadline,
  );
}

function missingSlots(memory: StudentMemory, leadProfile: LeadProfile) {
  return [
    !memory.level && !leadProfile.level ? "level" : undefined,
    !memory.countries?.length && !leadProfile.targetCountries?.length
      ? "country"
      : undefined,
    !memory.program && !leadProfile.program ? "program/field" : undefined,
    !memory.language && !leadProfile.language ? "language of study" : undefined,
    !memory.budget && !leadProfile.budget ? "budget" : undefined,
    !memory.languageTest && !leadProfile.languageTest
      ? "English test if relevant"
      : undefined,
    !memory.deadline && !leadProfile.deadline ? "intake/deadline" : undefined,
  ].filter(Boolean);
}

function knownFacts(memory: StudentMemory, leadProfile: LeadProfile) {
  return [
    memory.level || leadProfile.level
      ? `level=${memory.level ?? leadProfile.level}`
      : undefined,
    memory.countries?.length || leadProfile.targetCountries?.length
      ? `countries=${[
          ...(memory.countries ?? []),
          ...(leadProfile.targetCountries ?? []),
        ].join(", ")}`
      : undefined,
    memory.program || leadProfile.program
      ? `program=${memory.program ?? leadProfile.program}`
      : undefined,
    memory.language || leadProfile.language
      ? `language=${memory.language ?? leadProfile.language}`
      : undefined,
    memory.budget || leadProfile.budget
      ? `budget=${memory.budget ?? leadProfile.budget}`
      : undefined,
    memory.languageTest || leadProfile.languageTest
      ? `languageTest=${memory.languageTest ?? leadProfile.languageTest}`
      : undefined,
    memory.deadline || leadProfile.deadline
      ? `deadline=${memory.deadline ?? leadProfile.deadline}`
      : undefined,
    leadProfile.gpa ? `gpa=${leadProfile.gpa}` : undefined,
    leadProfile.riskFactors?.length
      ? `riskFactors=${leadProfile.riskFactors.join(", ")}`
      : undefined,
  ].filter(Boolean);
}

function messageShape(message: string) {
  const normalized = message.toLocaleLowerCase("ru").trim();

  return {
    isShort: normalized.split(/\s+/).filter(Boolean).length <= 8,
    looksLikeQuestion:
      normalized.includes("?") ||
      /(сколько|какие|какой|какая|как|когда|можно|нужн|хватит|что делать|куда)/.test(
        normalized,
      ),
    isMessyOrWeak:
      normalized.length <= 18 ||
      /(^|\s)(хз|ну|ээ|абоба|любой|любая)(\s|$)|не знаю|как-то|что-нибудь/.test(
        normalized,
      ),
  };
}

function buildGeminiUserPrompt(input: GeminiInput) {
  const ongoingConversation = hasKnownProfileFacts(
    input.memory,
    input.leadProfile,
  );
  const slotsMissing = missingSlots(input.memory, input.leadProfile);

  return JSON.stringify(
    {
      task:
        `Answer as ${productBrand.assistantName} and extract useful lead profile fields from this turn.`,
      responseContract: {
        answer:
          "Russian text. For admissions questions, be factual and usually 4-9 lines. For pure greetings, thanks, or 'how are you', reply briefly and warmly first, then invite a study-abroad goal. Be specific to the student's profile and avoid repeating a generic intro. Do not invent exact chances, exact visa outcome, exact scholarship or exact deadlines.",
        leadProfilePatch:
          "Only fields explicitly stated or strongly implied by the user. Supported fields: name, contact, countryOfResidence, level, targetCountries, program, language, budget, languageTest, gpa, deadline, riskFactors, notes.",
        handoff:
          "true when individual manager review is needed: visa risk, refusal, urgent deadline, low GPA, gap year, exact chances, exact legal/visa strategy, or user wants to start.",
        chips: "2-4 short follow-up suggestions in Russian.",
      },
      intentHypothesis: {
        intent: input.intent,
        confidence: input.confidence ?? null,
        shouldPreferHandoff: input.handoff,
      },
      conversationState: ongoingConversation
        ? "ongoing_slot_filling"
        : "new_or_empty_profile",
      messageShape: messageShape(input.userMessage),
      atlasScope: {
        supported:
          "study-abroad admissions: profile diagnostics, country/program selection, university shortlist, documents/applications, scholarships/budget, general student visa checklist, deadlines, offers, pre-departure, and manager support",
        outsideScopeRule:
          "If the request is outside this scope or not covered by retrievedKnowledge, do not improvise. Apologize briefly, say Atlas does not provide that service or lacks verified details, and list supported Atlas services.",
      },
      dialogueRules:
        ongoingConversation
          ? [
              "Routing order: first decide whether the latest message continues the active slot flow; then check direct FAQ/service/informational question; then country/program selection; fallback last.",
              "Continue from memory/currentLeadProfile. Do not restart.",
              "If the latest user message is short, messy, or incomplete, do a best-effort interpretation from context before asking a follow-up.",
              "If the latest message supplies a country, level, program, language, budget, test, or deadline, merge it into the profile and continue the current branch.",
              "If the user asks a direct FAQ, answer it directly first, then add at most one contextual follow-up.",
              "Do not use generic intro or marketing copy.",
              "Do not ask for a field that is already present in knownFacts.",
              "Ask only the single most useful missing slot unless the user requested a checklist.",
              "Confirm the new data, keep the recap short, and add one useful admissions note when it helps.",
            ]
          : [
              "If the user asks a direct FAQ, answer directly before asking for profile details.",
              "If the message is vague, make one reasonable interpretation and ask one narrowing question.",
              "Do not use a generic promotional intro.",
            ],
      knownFacts: knownFacts(input.memory, input.leadProfile),
      missingSlots: slotsMissing.slice(0, 5),
      memorySummary: input.memory.summary ?? null,
      currentLeadProfile: input.leadProfile,
      retrievedKnowledge: compactContext(input.chunks),
      userMessage: input.userMessage,
    },
    null,
    2,
  );
}

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function askGemini(input: GeminiInput) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Model API key is not configured.");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: `${ADMISSIONS_SYSTEM_PROMPT}

Return only valid JSON. Do not wrap it in Markdown.
JSON shape:
{
  "answer": "string",
  "leadProfilePatch": {},
  "handoff": boolean,
  "chips": ["string"]
}`,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildGeminiUserPrompt(input),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.25,
        topP: 0.85,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    const cooldownMs = cooldownForStatus(response.status, retryAfterMs);

    markGeminiUnavailable(cooldownMs);

    throw new GeminiRequestError(response.status, cooldownMs || retryAfterMs);
  }

  const data = (await response.json()) as GeminiGenerateResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Model returned an empty response.");
  }

  return normalizeStructuredReply(jsonFromText(text));
}
