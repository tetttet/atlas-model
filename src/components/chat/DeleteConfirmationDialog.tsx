"use client";

import { useEffect, useRef } from "react";

type DeleteConfirmationDialogProps = {
  confirmLabel: string;
  description: string;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
};

export function DeleteConfirmationDialog({
  confirmLabel,
  description,
  isOpen,
  onCancel,
  onConfirm,
  title,
}: DeleteConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    cancelButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4 py-6">
      <button
        aria-label="Отменить удаление"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        type="button"
      />

      <div
        aria-describedby="delete-confirmation-description"
        aria-labelledby="delete-confirmation-title"
        aria-modal="true"
        className="relative z-10 w-[min(92vw,420px)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--settings-bg)] p-5 text-[var(--text)] shadow-2xl shadow-black/30"
        role="alertdialog"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0">
            <h2
              className="text-base font-semibold leading-6 text-[var(--text)]"
              id="delete-confirmation-title"
            >
              {title}
            </h2>
            <p
              className="mt-1 text-sm leading-5 text-[var(--muted)]"
              id="delete-confirmation-description"
            >
              {description}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            className="h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--control-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
            onClick={onCancel}
            type="button"
          >
            Отмена
          </button>
          <button
            className="h-10 rounded-lg bg-[var(--danger)] px-4 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
