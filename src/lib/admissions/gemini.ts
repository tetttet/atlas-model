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
  memory: StudentMemory;
  leadProfile: LeadProfile;
  chunks: KnowledgeChunk[];
  handoff: boolean;
};

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

function buildGeminiUserPrompt(input: GeminiInput) {
  return JSON.stringify(
    {
      task:
        `Answer as ${productBrand.assistantName} and extract useful lead profile fields from this turn.`,
      responseContract: {
        answer:
          "Russian text, factual, usually 4-9 lines. Be specific to the student's profile and avoid repeating a generic intro. Do not invent exact chances, exact visa outcome, exact scholarship or exact deadlines.",
        leadProfilePatch:
          "Only fields explicitly stated or strongly implied by the user. Supported fields: name, contact, countryOfResidence, level, targetCountries, program, budget, languageTest, gpa, deadline, riskFactors, notes.",
        handoff:
          "true when individual manager review is needed: visa risk, refusal, urgent deadline, low GPA, gap year, exact chances, exact legal/visa strategy, or user wants to start.",
        chips: "2-4 short follow-up suggestions in Russian.",
      },
      intent: input.intent,
      shouldPreferHandoff: input.handoff,
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
    throw new Error(`Model request failed with ${response.status}.`);
  }

  const data = (await response.json()) as GeminiGenerateResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Model returned an empty response.");
  }

  return normalizeStructuredReply(jsonFromText(text));
}
