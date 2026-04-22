"use client";

import { FormEvent, useState } from "react";

type ConsultationFormProps = {
  email: string;
};

const levelOptions = [
  "Бакалавриат",
  "Магистратура",
  "Foundation / pathway",
  "Языковая программа",
  "Пока не уверен",
];

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function ConsultationForm({ email }: ConsultationFormProps) {
  const [status, setStatus] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = getFormValue(formData, "name");
    const subject = `Заявка на консультацию - ${name || "AtlasPath"}`;
    const body = [
      `Имя: ${name}`,
      `Контакт: ${getFormValue(formData, "contact")}`,
      `Уровень: ${getFormValue(formData, "level")}`,
      `Страны: ${getFormValue(formData, "countries")}`,
      `Направление: ${getFormValue(formData, "program")}`,
      `Бюджет: ${getFormValue(formData, "budget")}`,
      `Intake / дедлайн: ${getFormValue(formData, "deadline")}`,
      "",
      `Ситуация: ${getFormValue(formData, "case")}`,
    ].join("\n");

    setStatus("Заявка подготовлена. Откроется почтовый клиент.");
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form
      className="rounded-lg border border-[#d8d8d8] bg-white p-4 shadow-[0_18px_55px_rgba(17,17,17,0.08)] sm:p-5"
      onSubmit={onSubmit}
    >
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#e6e6e6] pb-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#6a6a6a]">
            Заявка
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-[#111111]">
            Разбор профиля
          </h2>
        </div>
        <span className="rounded-md border border-[#d2d2d2] bg-[#eeeeee] px-2.5 py-1 text-xs font-bold text-[#111111]">
          10 мин
        </span>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-[#111111]">
            Имя
            <input
              className="h-11 rounded-md border border-[#d1d1d1] bg-[#fafafa] px-3 text-sm text-[#111111] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#111111] focus:bg-white focus:ring-4 focus:ring-black/10"
              name="name"
              placeholder="Ваше имя"
              required
              type="text"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[#111111]">
            Контакт
            <input
              className="h-11 rounded-md border border-[#d1d1d1] bg-[#fafafa] px-3 text-sm text-[#111111] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#111111] focus:bg-white focus:ring-4 focus:ring-black/10"
              name="contact"
              placeholder="Email или телефон"
              required
              type="text"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-[#111111]">
          Уровень
          <select
            className="h-11 rounded-md border border-[#d1d1d1] bg-[#fafafa] px-3 text-sm text-[#111111] outline-none transition focus:border-[#111111] focus:bg-white focus:ring-4 focus:ring-black/10"
            defaultValue={levelOptions[0]}
            name="level"
          >
            {levelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-[#111111]">
            Страны
            <input
              className="h-11 rounded-md border border-[#d1d1d1] bg-[#fafafa] px-3 text-sm text-[#111111] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#111111] focus:bg-white focus:ring-4 focus:ring-black/10"
              name="countries"
              placeholder="Канада, Германия..."
              type="text"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[#111111]">
            Направление
            <input
              className="h-11 rounded-md border border-[#d1d1d1] bg-[#fafafa] px-3 text-sm text-[#111111] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#111111] focus:bg-white focus:ring-4 focus:ring-black/10"
              name="program"
              placeholder="Business, CS, design..."
              type="text"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-[#111111]">
            Бюджет
            <input
              className="h-11 rounded-md border border-[#d1d1d1] bg-[#fafafa] px-3 text-sm text-[#111111] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#111111] focus:bg-white focus:ring-4 focus:ring-black/10"
              name="budget"
              placeholder="Например 15 000 EUR"
              type="text"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[#111111]">
            Intake / дедлайн
            <input
              className="h-11 rounded-md border border-[#d1d1d1] bg-[#fafafa] px-3 text-sm text-[#111111] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#111111] focus:bg-white focus:ring-4 focus:ring-black/10"
              name="deadline"
              placeholder="Fall 2026, срочно..."
              type="text"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-[#111111]">
          Ситуация
          <textarea
            className="min-h-32 resize-y rounded-md border border-[#d1d1d1] bg-[#fafafa] px-3 py-3 text-sm text-[#111111] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#111111] focus:bg-white focus:ring-4 focus:ring-black/10"
            name="case"
            placeholder="Оценки, язык, документы, визовые вопросы или ограничения по срокам"
            required
          />
        </label>

        <button
          className="h-12 rounded-md bg-[#2b2a28] px-4 text-sm font-bold text-white transition hover:bg-[#393735] focus:outline-none focus:ring-4 focus:ring-[#2b2a28]/15"
          type="submit"
        >
          Отправить заявку
        </button>

        {status ? (
          <p className="text-sm font-medium text-[#5f5f5f]" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </form>
  );
}
