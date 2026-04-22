import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ConsultationForm } from "@/components/consultation/ConsultationForm";
import { productBrand } from "@/lib/admissions/brand";
import {
  openGraphImage,
  twitterImage,
} from "@/lib/admissions/site-metadata";
import {
  company,
  companyContacts,
  consultationContent,
} from "@/lib/admissions/site-content";

const pageTitle = `${consultationContent.title} - ${company.name}`;
const pageDescription = consultationContent.summary;

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/consultation",
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/consultation",
    siteName: company.name,
    images: openGraphImage,
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: twitterImage,
  },
};

const reviewItems = [
  {
    title: "Профиль",
    text: "Уровень, оценки, язык, опыт, риски и сильные стороны.",
  },
  {
    title: "Маршрут",
    text: "Страны, программы, дедлайны и реалистичный shortlist.",
  },
  {
    title: "Документы",
    text: "CV, motivation letter, рекомендации, переводы и визовый пакет.",
  },
];

const steps = [
  "Получаем заявку и фиксируем вводные",
  "Проверяем базовые требования по странам и программам",
  "Возвращаем следующий шаг: чат, звонок или план сопровождения",
];

export default function ConsultationPage() {
  return (
    <main className="min-h-dvh bg-[#f4f4f4] text-[#111111]">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[#d8d8d8] pb-4">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-[#111111]">
              <Image
                alt=""
                height={40}
                priority
                src="/atlaspath-mark.svg"
                width={40}
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#111111]">
                {productBrand.assistantName}
              </span>
              <span className="block truncate text-xs font-medium text-[#6a6a6a]">
                {company.shortName}
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link
              className="rounded-md px-3 py-2 text-[#3f3f3f] transition hover:bg-white hover:text-[#111111]"
              href="/pricing"
            >
              Стоимость
            </Link>
            <Link
              className="rounded-md bg-[#2b2a28] px-3 py-2 text-white transition hover:bg-[#393735]"
              href="/"
            >
              Чат
            </Link>
          </nav>
        </header>

        <section className="grid gap-6 py-6 lg:min-h-[calc(100dvh-5.5rem)] lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-8">
          <div className="space-y-6">
            <div className="inline-flex rounded-md border border-[#d8d8d8] bg-white px-3 py-2 text-sm font-semibold text-[#3f3f3f] shadow-sm">
              Консультация по поступлению
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold leading-[1.04] text-[#111111] sm:text-5xl lg:text-6xl">
                Разберем поступление без хаоса и лишних обещаний
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#555555] sm:text-lg">
                Оставьте вводные, а менеджер Atlas соберет первый маршрут:
                страны, программы, документы, дедлайны и риски по вашему
                профилю.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {reviewItems.map((item) => (
                <article
                  className="rounded-lg border border-[#d8d8d8] bg-white p-4 shadow-sm"
                  key={item.title}
                >
                  <p className="text-sm font-bold text-[#111111]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>

            <div className="grid gap-2 text-sm font-medium text-[#444444] sm:grid-cols-2">
              {consultationContent.reasons.map((reason) => (
                <span
                  className="rounded-md border border-[#d2d2d2] bg-[#eeeeee] px-3 py-2"
                  key={reason}
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>

          <ConsultationForm email={companyContacts.email} />
        </section>

        <section className="border-t border-[#d8d8d8] py-8">
          <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-sm font-bold uppercase text-[#777777]">
                Процесс
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[#111111]">
                Что будет после заявки
              </h2>
            </div>
            <ol className="grid gap-3 md:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  className="rounded-lg border border-[#d8d8d8] bg-white p-4"
                  key={step}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-[#111111] text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="mt-4 text-sm font-semibold leading-6 text-[#333333]">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-[#d8d8d8] py-5 text-sm text-[#5f5f5f] sm:flex-row sm:items-center sm:justify-between">
          <p>{company.name}</p>
          <div className="flex flex-wrap gap-3 font-semibold">
            <a
              className="hover:text-[#111111]"
              href={`mailto:${companyContacts.email}`}
            >
              {companyContacts.email}
            </a>
            <a
              className="hover:text-[#111111]"
              href={companyContacts.instagram}
              rel="noreferrer"
              target="_blank"
            >
              Instagram
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
