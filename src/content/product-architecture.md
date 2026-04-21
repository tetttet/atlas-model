# AtlasPath Admissions MVP Architecture

## Product concept

AtlasPath Admissions - минималистичный AI-first продукт для студентов, которые хотят поступать за границу. Первый экран - чат. Не лендинг, не перегруженный портал. Пользователь пишет вопрос и получает краткий ответ, ссылку на нужную страницу или передачу менеджеру.

## Brand

Название: AtlasPath Admissions  
Слоган: "Поступление за границу без хаоса, догадок и потерянных дедлайнов."  
Стиль: чистый интерфейс, спокойные цвета, аккуратное окно чата, быстрые ответы.  
Tone of voice: коротко, спокойно, экспертно, без обещаний гарантии.

## Site map

- `/` - chat-first главная;
- `/countries` - страны;
- `/universities` - университеты и программы;
- `/documents` - документы;
- `/deadlines` - дедлайны;
- `/pricing` - стоимость;
- `/process` - процесс;
- `/consultation` - консультация и handoff;
- `/contacts` - контакты;
- `/faq` - FAQ.

## Frontend

Stack:
- Next.js App Router;
- React client component только для чата;
- Tailwind CSS;
- server-rendered content pages;
- no external UI library for MVP.

UI:
- centered chat window;
- bot and user bubbles;
- quick chips;
- CTA links inside bot answers;
- input at bottom;
- mobile-first layout;
- no heavy hero, no marketing noise.

## Backend

Route: `POST /api/chat`

Flow:
1. Validate message length.
2. Classify intent.
3. Update lightweight memory.
4. Retrieve relevant knowledge chunks.
5. Extract lead profile fields.
6. For simple questions, answer with deterministic grounded logic.
7. For complex, uncertain, application-start or handoff cases, call Gemini server-side.
8. Return answer, chips, links, actions, sources, memory and lead profile.

Gemini:
- key is stored only in `GEMINI_API_KEY`;
- model defaults to `gemini-flash-latest`;
- `GEMINI_MODE=complex` keeps token usage low;
- `GEMINI_MODE=always` routes every turn to Gemini;
- client never receives the API key.

## Knowledge base

Human-readable source: `src/content/knowledge-base.md`  
Runtime structured source: `src/lib/admissions/site-content.ts`

Runtime data includes:
- company;
- services;
- site pages;
- country profiles;
- document checklists;
- pricing;
- routing rules;
- handoff triggers;
- knowledge chunks.

## Retrieval

MVP retrieval is deterministic:
- score by intent match;
- score by keyword match;
- small priority boost;
- return top 3-4 chunks;
- use compact context only.

Production retrieval upgrade:
- split `knowledge-base.md` into chunks;
- embed chunks with a small embedding model;
- store vectors in Postgres + pgvector, Supabase, Neon or Upstash Vector;
- retrieve top-k by semantic similarity;
- rerank by intent and handoff risk.

## Intent classification

Supported intents:
- documents;
- country_fit;
- language_test;
- pricing;
- deadlines;
- visa;
- process;
- universities;
- application_start;
- complex_case;
- services;
- contact;
- general.

Production upgrade:
- keep deterministic keyword guardrails;
- add small LLM classifier returning JSON;
- compare LLM result with rules;
- if conflict or low confidence, ask clarifying question or route to manager.

## Prompt flow

System prompt: `src/content/system-prompt.md` and `src/lib/admissions/prompt.ts`

Prompt payload:
- system prompt;
- latest user message;
- classified intent;
- memory summary;
- retrieved context only;
- routing rules.

Token policy:
- never send the whole KB;
- keep memory as a short summary;
- send only top 3-4 chunks;
- answers target 3-7 lines;
- link instead of explaining everything.

## Chat memory

Memory stores only stable facts:
- level;
- countries;
- program;
- budget;
- language test;
- deadline;
- last intent;
- compact summary.

No sensitive documents are stored in MVP memory.

## Lead profile storage

MVP stores the conversation state in browser `localStorage` under `atlaspath.chat.v1`.

Saved fields:
- messages, last 40 turns;
- lightweight memory;
- lead profile: name, contact, country of residence, level, countries, program, budget, language test, GPA, deadline, risk factors, notes, completeness.

Production replacement:
- create `POST /api/leads`;
- store profiles in Postgres/Supabase/Neon;
- keep consent and privacy copy near the lead form;
- encrypt sensitive fields;
- keep localStorage only as draft cache.

## Escalation to human

Trigger manager handoff if:
- visa refusal;
- urgent deadline under 30 days;
- low GPA;
- academic gap;
- gap year;
- change of major;
- scholarship-only strategy;
- exact chance evaluation;
- exact visa strategy;
- incomplete documents;
- minor student;
- user explicitly asks for manager.

## Example bot behavior

Documents:
"Обычно нужны паспорт, документ об образовании, транскрипт, CV, мотивационное письмо, рекомендации и язык. Точный список зависит от страны, уровня и программы. Ссылка: `/documents`."

Country fit:
"Страну выбираем по бюджету, языку, уровню, срокам и цели. Германия часто сильна по tuition, Италия по бюджету и DSU, Канада по applied programs, Нидерланды по англоязычным программам. Напишите бюджет, направление и intake."

IELTS:
"Не всегда. Часто нужен IELTS/TOEFL/Duolingo, но иногда возможен waiver или internal test. Точный балл проверяется по программе."

Pricing:
"Бюджет - это tuition, проживание, виза, страховка, переводы, экзамены и резерв. Для точного расчета нужны страна, уровень и город."

Deadlines:
"Безопасно начинать за 9-12 месяцев. Для стипендий и топовых программ - за 12-15 месяцев. Срочные сроки лучше передать менеджеру."

Start:
"Нужны уровень, направление, оценки/GPA, язык, бюджет, страны и intake. Дальше менеджер соберет маршрут."

Complex case:
"Не буду угадывать. Нужен менеджер. Пришлите страну проживания, уровень, оценки, направление, бюджет, intake и проблему."
