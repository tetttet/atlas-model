export type AdmissionIntent =
  | "documents"
  | "country_fit"
  | "language_test"
  | "pricing"
  | "deadlines"
  | "visa"
  | "process"
  | "universities"
  | "application_start"
  | "complex_case"
  | "services"
  | "contact"
  | "general";

export type StudyLevel =
  | "foundation"
  | "bachelor"
  | "master"
  | "phd"
  | "language"
  | "unknown";

export type LinkTarget = {
  label: string;
  href: string;
};

export type KnowledgeChunk = {
  id: string;
  title: string;
  intentTags: AdmissionIntent[];
  keywords: string[];
  summary: string;
  content: string[];
  links: LinkTarget[];
  priority: number;
  requiresHuman?: boolean;
};

export type SiteSection = {
  heading: string;
  body: string[];
  bullets?: string[];
};

export type SitePage = {
  slug: string;
  title: string;
  navLabel: string;
  summary: string;
  cta: string;
  sections: SiteSection[];
};

export type CountryProfile = {
  slug: string;
  name: string;
  bestFor: string[];
  typicalPrograms: string[];
  tuition: string;
  livingCost: string;
  language: string;
  deadlines: string;
  visa: string;
  notes: string[];
};

export type StudentMemory = {
  level?: StudyLevel;
  countries?: string[];
  program?: string;
  language?: string;
  budget?: string;
  languageTest?: string;
  deadline?: string;
  lastIntent?: AdmissionIntent;
  summary?: string;
};

export type LeadProfile = {
  name?: string;
  contact?: string;
  countryOfResidence?: string;
  level?: StudyLevel;
  targetCountries?: string[];
  program?: string;
  language?: string;
  budget?: string;
  languageTest?: string;
  gpa?: string;
  deadline?: string;
  riskFactors?: string[];
  notes?: string[];
  lastUpdatedAt?: string;
  completeness?: number;
  summary?: string;
};

export type IntentResult = {
  intent: AdmissionIntent;
  confidence: number;
  matchedKeywords: string[];
  needsHuman: boolean;
};

export type ChatAction = {
  type: "link" | "lead" | "handoff";
  label: string;
  href?: string;
};

export type BotReply = {
  answer: string;
  engine: "local" | "atlas" | "atlas-fallback";
  intent: AdmissionIntent;
  confidence: number;
  actions: ChatAction[];
  links: LinkTarget[];
  chips: string[];
  sources: string[];
  memory: StudentMemory;
  leadProfile: LeadProfile;
  handoff: boolean;
};

export type ChatRequest = {
  message: string;
  memory?: StudentMemory;
  leadProfile?: LeadProfile;
};

export type GeminiStructuredReply = {
  answer: string;
  leadProfilePatch?: Partial<LeadProfile>;
  handoff?: boolean;
  chips?: string[];
};
