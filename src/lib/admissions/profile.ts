import { countries, handoffTriggers } from "./site-content";
import type {
  AdmissionIntent,
  LeadProfile,
  StudentMemory,
  StudyLevel,
} from "./types";

const requiredLeadFields: Array<keyof LeadProfile> = [
  "level",
  "program",
  "budget",
  "deadline",
  "contact",
];

function normalize(input: string) {
  return input.toLocaleLowerCase("ru").trim();
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function sanitizeText(value: unknown, maxLength = 160) {
  if (typeof value !== "string") {
    return undefined;
  }

  const clean = value.trim().replace(/\s+/g, " ");

  return clean ? clean.slice(0, maxLength) : undefined;
}

function sanitizeStringArray(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return unique(
    value
      .map((item) => sanitizeText(item, 90))
      .filter((item): item is string => Boolean(item)),
  ).slice(0, maxItems);
}

function sanitizeLevel(value: unknown): StudyLevel | undefined {
  if (
    value === "foundation" ||
    value === "bachelor" ||
    value === "master" ||
    value === "phd" ||
    value === "language" ||
    value === "unknown"
  ) {
    return value;
  }

  return undefined;
}

function compactSummary(profile: LeadProfile) {
  const parts = [
    profile.name && `имя: ${profile.name}`,
    profile.level && `уровень: ${profile.level}`,
    profile.targetCountries?.length &&
      `страны: ${profile.targetCountries.join(", ")}`,
    profile.program && `направление: ${profile.program}`,
    profile.budget && `бюджет: ${profile.budget}`,
    profile.languageTest && `язык: ${profile.languageTest}`,
    profile.deadline && `intake: ${profile.deadline}`,
    profile.riskFactors?.length && `риски: ${profile.riskFactors.join(", ")}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("; ") : undefined;
}

function completeness(profile: LeadProfile) {
  const filled = requiredLeadFields.filter((field) => Boolean(profile[field]));
  const countryFilled =
    Boolean(profile.targetCountries?.length) || Boolean(profile.countryOfResidence);

  return Math.round(((filled.length + (countryFilled ? 1 : 0)) / 6) * 100);
}

export function sanitizeLeadPatch(patch: Partial<LeadProfile> = {}) {
  const clean: Partial<LeadProfile> = {};

  clean.name = sanitizeText(patch.name, 80);
  clean.contact = sanitizeText(patch.contact, 120);
  clean.countryOfResidence = sanitizeText(patch.countryOfResidence, 90);
  clean.level = sanitizeLevel(patch.level);
  clean.targetCountries = sanitizeStringArray(patch.targetCountries);
  clean.program = sanitizeText(patch.program, 120);
  clean.budget = sanitizeText(patch.budget, 80);
  clean.languageTest = sanitizeText(patch.languageTest, 80);
  clean.gpa = sanitizeText(patch.gpa, 80);
  clean.deadline = sanitizeText(patch.deadline, 90);
  clean.riskFactors = sanitizeStringArray(patch.riskFactors);
  clean.notes = sanitizeStringArray(patch.notes, 10);

  return Object.fromEntries(
    Object.entries(clean).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return Boolean(value);
    }),
  ) as Partial<LeadProfile>;
}

export function mergeLeadProfile(
  previous: LeadProfile | undefined,
  patch: Partial<LeadProfile>,
) {
  const cleanPatch = sanitizeLeadPatch(patch);
  const merged: LeadProfile = {
    ...previous,
    ...cleanPatch,
    targetCountries: unique([
      ...(previous?.targetCountries ?? []),
      ...(cleanPatch.targetCountries ?? []),
    ]),
    riskFactors: unique([
      ...(previous?.riskFactors ?? []),
      ...(cleanPatch.riskFactors ?? []),
    ]),
    notes: unique([...(previous?.notes ?? []), ...(cleanPatch.notes ?? [])]).slice(
      -10,
    ),
    lastUpdatedAt: new Date().toISOString(),
  };

  merged.completeness = completeness(merged);
  merged.summary = compactSummary(merged);

  return merged;
}

export function extractLeadProfile(
  previous: LeadProfile | undefined,
  message: string,
  memory: StudentMemory,
  intent: AdmissionIntent,
) {
  const normalized = normalize(message);
  const patch: Partial<LeadProfile> = {
    level: memory.level,
    targetCountries: memory.countries,
    program: memory.program,
    budget: memory.budget,
    languageTest: memory.languageTest,
    deadline: memory.deadline,
  };

  const nameMatch = message.match(
    /(?:меня зовут|я)\s+([A-ZА-ЯЁ][A-Za-zА-Яа-яЁё'-]{1,30})(?:\s|$|,|\.)/,
  );

  if (nameMatch) {
    patch.name = nameMatch[1];
  }

  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = message.match(
    /(?:\+?\d[\s().-]*){8,}\d/,
  );

  if (emailMatch) {
    patch.contact = emailMatch[0];
  } else if (phoneMatch) {
    patch.contact = phoneMatch[0].trim();
  }

  const residenceMatch = message.match(
    /(?:живу в|из|нахожусь в)\s+([A-ZА-ЯЁ][A-Za-zА-Яа-яЁё\s-]{2,40})/,
  );

  if (residenceMatch) {
    patch.countryOfResidence = residenceMatch[1].trim();
  }

  const gpaMatch = normalized.match(
    /(?:gpa|средний балл|оценки)\s*[:=-]?\s*([0-9][0-9.,/ ]{0,8})/,
  );

  if (gpaMatch) {
    patch.gpa = gpaMatch[0];
  }

  const mentionedCountries = countries
    .filter((country) => normalized.includes(normalize(country.name)))
    .map((country) => country.name);

  if (mentionedCountries.length > 0) {
    patch.targetCountries = unique([
      ...(patch.targetCountries ?? []),
      ...mentionedCountries,
    ]);
  }

  const riskFactors = handoffTriggers.filter((trigger) =>
    normalized.includes(normalize(trigger)),
  );

  if (riskFactors.length > 0 || intent === "complex_case") {
    patch.riskFactors = unique([
      ...(riskFactors.length > 0 ? riskFactors : ["индивидуальный случай"]),
    ]);
  }

  if (intent === "application_start" || intent === "complex_case") {
    patch.notes = [message.slice(0, 220)];
  }

  return mergeLeadProfile(previous, patch);
}
