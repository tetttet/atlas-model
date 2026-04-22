import { knowledgeChunks } from "./site-content";
import type { AdmissionIntent, KnowledgeChunk, StudentMemory } from "./types";

function normalize(input: string) {
  return input.toLocaleLowerCase("ru");
}

function scoreChunk(
  chunk: KnowledgeChunk,
  intent: AdmissionIntent,
  message: string,
  memory?: StudentMemory,
) {
  const normalized = normalize(message);
  const intentScore = chunk.intentTags.includes(intent) ? 12 : 0;
  const keywordScore = chunk.keywords.reduce((score, keyword) => {
    return normalized.includes(normalize(keyword)) ? score + 3 : score;
  }, 0);
  const countryScore =
    memory?.countries?.some((country) =>
      normalized.includes(normalize(country)),
    ) || false
      ? 2
      : 0;
  const hasMatch = intentScore > 0 || keywordScore > 0 || countryScore > 0;

  return hasMatch ? intentScore + keywordScore + countryScore + chunk.priority : 0;
}

export function retrieveKnowledge(
  intent: AdmissionIntent,
  message: string,
  memory?: StudentMemory,
  limit = 6,
) {
  return knowledgeChunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, intent, message, memory),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
}

export function compactContext(chunks: KnowledgeChunk[]) {
  return chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.title,
    summary: chunk.summary,
    facts: chunk.content.slice(0, 4),
    links: chunk.links,
  }));
}
