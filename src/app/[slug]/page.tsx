import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productBrand } from "@/lib/admissions/brand";
import { company, sitePages } from "@/lib/admissions/site-content";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return sitePages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = sitePages.find((item) => item.slug === slug);

  if (!page) {
    return {
      title: company.name,
    };
  }

  return {
    title: `${page.title} - ${company.name}`,
    description: page.summary,
  };
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params;
  const page = sitePages.find((item) => item.slug === slug);

  if (!page) {
    notFound();
  }

  const isConsultation = page.slug === "consultation";

  return (
    <main className="min-h-dvh bg-[#f7f8f4]">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <nav className="mb-10 flex items-center justify-between gap-4">
          <Link
            className="text-sm font-semibold text-[#0f766e] transition hover:text-[#0b5f59]"
            href="/"
          >
            {productBrand.assistantName}
          </Link>
          <Link
            className="rounded-full bg-[#14213d] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#253252]"
            href="/consultation"
          >
            Консультация
          </Link>
        </nav>

        <header className="mb-9 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#0f766e]">
            {company.shortName}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-[#14213d] sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#52615c]">
            {page.summary}
          </p>
        </header>

        <div className="space-y-8">
          {page.sections.map((section) => (
            <section
              className="border-t border-[#dfe6dd] pt-7"
              key={section.heading}
            >
              <h2 className="text-xl font-semibold text-[#14213d]">
                {section.heading}
              </h2>
              <div className="mt-4 space-y-3 text-base leading-7 text-[#33423f]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.bullets ? (
                <ul className="mt-5 grid gap-3 text-sm leading-6 text-[#33423f] sm:grid-cols-2">
                  {section.bullets.map((bullet) => (
                    <li
                      className="border-l-2 border-[#0f766e] bg-white px-4 py-3"
                      key={bullet}
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {isConsultation ? (
          <form className="mt-10 grid gap-4 border-t border-[#dfe6dd] pt-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-[#14213d]">
                Имя
                <input
                  className="rounded-2xl border border-[#cfdad0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10"
                  name="name"
                  placeholder="Ваше имя"
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#14213d]">
                Контакт
                <input
                  className="rounded-2xl border border-[#cfdad0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10"
                  name="contact"
                  placeholder="Email или телефон"
                  type="text"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-[#14213d]">
                Уровень
                <input
                  className="rounded-2xl border border-[#cfdad0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10"
                  name="level"
                  placeholder="Bachelor, master..."
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#14213d]">
                Страны
                <input
                  className="rounded-2xl border border-[#cfdad0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10"
                  name="countries"
                  placeholder="Канада, Германия..."
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#14213d]">
                Бюджет
                <input
                  className="rounded-2xl border border-[#cfdad0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10"
                  name="budget"
                  placeholder="Например 15 000 EUR"
                  type="text"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium text-[#14213d]">
              Ситуация
              <textarea
                className="min-h-32 rounded-2xl border border-[#cfdad0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10"
                name="case"
                placeholder="Направление, оценки, сроки, вопросы по визе или документам"
              />
            </label>
            <button
              className="w-fit rounded-full bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b5f59]"
              type="submit"
            >
              Отправить заявку
            </button>
          </form>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3 border-t border-[#dfe6dd] pt-7">
          <Link
            className="rounded-full bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b5f59]"
            href="/"
          >
            Вернуться к чату
          </Link>
          <Link
            className="rounded-full border border-[#cfdad0] px-5 py-3 text-sm font-semibold text-[#14213d] transition hover:border-[#0f766e] hover:text-[#0f766e]"
            href="/consultation"
          >
            {page.cta}
          </Link>
        </div>
      </div>
    </main>
  );
}
