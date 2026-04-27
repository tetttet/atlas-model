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
const DEFAULT_GEMINI_TIMEOUT_MS = 7000;
const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 500;

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

export class GeminiTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Model request timed out after ${timeoutMs}ms.`);
    this.name = "GeminiTimeoutError";
    this.timeoutMs = timeoutMs;
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

export type GeminiInput = {
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

function geminiModel() {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

function geminiTimeoutMs() {
  return envNumber("GEMINI_TIMEOUT_MS", DEFAULT_GEMINI_TIMEOUT_MS);
}

function geminiMaxOutputTokens() {
  return envNumber("GEMINI_MAX_OUTPUT_TOKENS", DEFAULT_GEMINI_MAX_OUTPUT_TOKENS);
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

function compactLeadProfile(leadProfile: LeadProfile) {
  return Object.fromEntries(
    Object.entries({
      name: leadProfile.name,
      countryOfResidence: leadProfile.countryOfResidence,
      level: leadProfile.level,
      targetCountries: leadProfile.targetCountries,
      program: leadProfile.program,
      language: leadProfile.language,
      budget: leadProfile.budget,
      languageTest: leadProfile.languageTest,
      gpa: leadProfile.gpa,
      deadline: leadProfile.deadline,
      riskFactors: leadProfile.riskFactors,
      summary: leadProfile.summary,
    }).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return Boolean(value);
    }),
  );
}

function compactRetrievedKnowledge(chunks: KnowledgeChunk[]) {
  return compactContext(chunks)
    .slice(0, 4)
    .map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      summary: chunk.summary,
      facts: chunk.facts.slice(0, 3),
      links: chunk.links.slice(0, 2),
    }));
}

function compactRecentContext(memory: StudentMemory) {
  return Object.fromEntries(
    Object.entries({
      lastUserMessage: memory.lastUserMessage,
      lastBotQuestion: memory.lastBotQuestion,
      lastIntent: memory.lastIntent,
      lastTopic: memory.lastTopic,
      lastSuggestedChips: memory.lastSuggestedChips,
      userGoal: memory.userGoal,
      unansweredQuestion: memory.unansweredQuestion,
      repeatedCount: memory.repeatedCount,
    }).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return value !== undefined && value !== "";
    }),
  );
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
          "Russian text, usually 3-6 short lines. Be specific to the profile, avoid generic intros, and do not invent exact chances, exact visa outcomes, scholarships, or deadlines.",
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
      recentContext: compactRecentContext(input.memory),
      currentLeadProfile: compactLeadProfile(input.leadProfile),
      retrievedKnowledge: compactRetrievedKnowledge(input.chunks),
      userMessage: input.userMessage,
    },
    null,
  2,
  );
}

function buildSystemInstruction() {
  return `${productBrand.assistantName} is a concise Russian admissions assistant for ${productBrand.companyShortName}.
Answer only from the supplied profile and retrieved knowledge. If exact admissions, visa, scholarship, deadline, or chance data is not supplied, say it needs checking.
Do not restart the conversation when recentContext contains an active topic.
Return only valid JSON. Do not wrap it in Markdown.
JSON shape:
{
  "answer": "string",
  "leadProfilePatch": {},
  "handoff": boolean,
  "chips": ["string"]
}`;
}

function buildGeminiRequestBody(input: GeminiInput) {
  return {
    systemInstruction: {
      parts: [
        {
          text: buildSystemInstruction(),
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
      maxOutputTokens: geminiMaxOutputTokens(),
      responseMimeType: "application/json",
    },
  };
}

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function askGemini(input: GeminiInput) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Model API key is not configured.");
  }

  const model = geminiModel();
  const timeoutMs = geminiTimeoutMs();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  console.info(`[gemini] started model=${model}`);

  let response: Response;

  try {
    try {
      response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify(buildGeminiRequestBody(input)),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        console.warn(`[gemini] timeout after ${timeoutMs}ms fallback=local`);
        throw new GeminiTimeoutError(timeoutMs);
      }

      console.warn("[gemini] network_error fallback=local", error);
      throw error;
    }

    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const cooldownMs = cooldownForStatus(response.status, retryAfterMs);

      markGeminiUnavailable(cooldownMs);

      throw new GeminiRequestError(response.status, cooldownMs || retryAfterMs);
    }

    let data: GeminiGenerateResponse;

    try {
      data = (await response.json()) as GeminiGenerateResponse;
    } catch (error) {
      if (controller.signal.aborted) {
        console.warn(`[gemini] timeout after ${timeoutMs}ms fallback=local`);
        throw new GeminiTimeoutError(timeoutMs);
      }

      console.warn("[gemini] invalid JSON response fallback=local");
      throw error;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.warn("[gemini] empty response fallback=local");
      throw new Error("Model returned an empty response.");
    }

    try {
      const structuredReply = normalizeStructuredReply(jsonFromText(text));

      if (!structuredReply.answer) {
        console.warn("[gemini] malformed response empty_answer fallback=local");
        throw new Error("Model returned a malformed response.");
      }

      console.info(`[gemini] success durationMs=${Date.now() - startedAt}`);
      return structuredReply;
    } catch (error) {
      console.warn("[gemini] invalid JSON text fallback=local");
      throw error;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

type GeminiStreamOptions = {
  onAnswerDelta?: (delta: string) => void;
};

function responseTextFromGenerateResponse(data: GeminiGenerateResponse) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? ""
  );
}

function extractPartialJsonString(rawText: string, key: string) {
  const keyIndex = rawText.indexOf(`"${key}"`);

  if (keyIndex === -1) {
    return "";
  }

  const colonIndex = rawText.indexOf(":", keyIndex);

  if (colonIndex === -1) {
    return "";
  }

  const quoteIndex = rawText.indexOf("\"", colonIndex + 1);

  if (quoteIndex === -1) {
    return "";
  }

  let value = "";
  let escaping = false;

  for (let index = quoteIndex + 1; index < rawText.length; index += 1) {
    const char = rawText[index];

    if (escaping) {
      switch (char) {
        case "\"":
        case "\\":
        case "/":
          value += char;
          break;
        case "n":
          value += "\n";
          break;
        case "r":
          value += "\r";
          break;
        case "t":
          value += "\t";
          break;
        case "b":
          value += "\b";
          break;
        case "f":
          value += "\f";
          break;
        case "u": {
          const code = rawText.slice(index + 1, index + 5);

          if (code.length < 4) {
            return value;
          }

          const parsed = Number.parseInt(code, 16);
          value += Number.isNaN(parsed) ? "" : String.fromCharCode(parsed);
          index += 4;
          break;
        }
        default:
          value += char;
      }

      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === "\"") {
      return value;
    }

    value += char;
  }

  return value;
}

function parseSsePayloads(chunk: string, pending: string) {
  const normalized = `${pending}${chunk}`.replace(/\r\n/g, "\n");
  const events = normalized.split("\n\n");
  const nextPending = events.pop() ?? "";
  const payloads = events
    .map((event) =>
      event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n"),
    )
    .filter(Boolean);

  return {
    payloads,
    pending: nextPending,
  };
}

export async function askGeminiStream(
  input: GeminiInput,
  options: GeminiStreamOptions = {},
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Model API key is not configured.");
  }

  const model = geminiModel();
  const timeoutMs = geminiTimeoutMs();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  console.info(`[gemini] started model=${model} streaming=true`);

  let response: Response;

  try {
    response = await fetch(
      `${GEMINI_ENDPOINT}/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify(buildGeminiRequestBody(input)),
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (controller.signal.aborted) {
      console.warn(`[gemini] timeout after ${timeoutMs}ms fallback=local`);
      throw new GeminiTimeoutError(timeoutMs);
    }

    console.warn("[gemini] network_error fallback=local", error);
    throw error;
  }

  try {
    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const cooldownMs = cooldownForStatus(response.status, retryAfterMs);

      markGeminiUnavailable(cooldownMs);

      throw new GeminiRequestError(response.status, cooldownMs || retryAfterMs);
    }

    if (!response.body) {
      console.warn("[gemini] empty stream body fallback=local");
      throw new Error("Model returned an empty stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let rawText = "";
    let streamedAnswer = "";

    while (true) {
      let readResult: ReadableStreamReadResult<Uint8Array>;

      try {
        readResult = await reader.read();
      } catch (error) {
        if (controller.signal.aborted) {
          console.warn(`[gemini] timeout after ${timeoutMs}ms fallback=local`);
          throw new GeminiTimeoutError(timeoutMs);
        }

        throw error;
      }

      if (readResult.done) {
        break;
      }

      const parsed = parseSsePayloads(
        decoder.decode(readResult.value, { stream: true }),
        pending,
      );
      pending = parsed.pending;

      for (const payload of parsed.payloads) {
        let data: GeminiGenerateResponse;

        try {
          data = JSON.parse(payload) as GeminiGenerateResponse;
        } catch (error) {
          console.warn("[gemini] invalid stream JSON chunk fallback=local");
          throw error;
        }

        rawText += responseTextFromGenerateResponse(data);

        const nextAnswer = extractPartialJsonString(rawText, "answer");

        if (nextAnswer.length > streamedAnswer.length) {
          const delta = nextAnswer.slice(streamedAnswer.length);
          streamedAnswer = nextAnswer;
          options.onAnswerDelta?.(delta);
        }
      }
    }

    if (pending.trim()) {
      const payload = pending
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

      if (payload) {
        const data = JSON.parse(payload) as GeminiGenerateResponse;
        rawText += responseTextFromGenerateResponse(data);
      }
    }

    if (!rawText.trim()) {
      console.warn("[gemini] empty streamed response fallback=local");
      throw new Error("Model returned an empty response.");
    }

    const structuredReply = normalizeStructuredReply(jsonFromText(rawText));

    if (!structuredReply.answer) {
      console.warn("[gemini] malformed streamed response fallback=local");
      throw new Error("Model returned a malformed response.");
    }

    if (structuredReply.answer.length > streamedAnswer.length) {
      options.onAnswerDelta?.(structuredReply.answer.slice(streamedAnswer.length));
    }

    console.info(`[gemini] success durationMs=${Date.now() - startedAt}`);
    return structuredReply;
  } catch (error) {
    if (controller.signal.aborted && !(error instanceof GeminiTimeoutError)) {
      console.warn(`[gemini] timeout after ${timeoutMs}ms fallback=local`);
      throw new GeminiTimeoutError(timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
