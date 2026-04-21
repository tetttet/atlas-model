import Image from "next/image";
import { productBrand } from "@/lib/admissions/brand";
import type { ChatSession, ThemeMode } from "./chat-types";
import { PlusIcon, SettingsIcon, TrashIcon } from "./icons";
import { ThemeSwitch } from "./ThemeSwitch";

type ChatSidebarProps = {
  activeChatId: string;
  chats: ChatSession[];
  isOpen: boolean;
  isSettingsOpen: boolean;
  onClearAllChats: () => void;
  onClose: () => void;
  onCloseSettings: () => void;
  onCreateChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onSelectChat: (chatId: string) => void;
  onToggleSettings: () => void;
  onToggleTheme: () => void;
  theme: ThemeMode;
};

export function ChatSidebar({
  activeChatId,
  chats,
  isOpen,
  isSettingsOpen,
  onClearAllChats,
  onClose,
  onCloseSettings,
  onCreateChat,
  onDeleteChat,
  onSelectChat,
  onToggleSettings,
  onToggleTheme,
  theme,
}: ChatSidebarProps) {
  return (
    <>
      <button
        aria-label="Закрыть sidebar"
        className={`fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        type="button"
      />

      <aside
        aria-label="Список чатов"
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(86vw,340px)] max-w-[340px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] shadow-2xl shadow-black/20 transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 px-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--brand-bg)] shadow-sm">
            <Image
              alt=""
              height={36}
              priority
              src="/atlaspath-mark.svg"
              width={36}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text)]">
              {productBrand.assistantName}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">Чаты</p>
          </div>
          <button
            aria-label="Новый чат"
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
            onClick={onCreateChat}
            title="Новый чат"
            type="button"
          >
            <PlusIcon />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <ul className="space-y-1">
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId;

              return (
                <li className="group flex items-center gap-1" key={chat.id}>
                  <button
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left transition focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] ${
                      isActive
                        ? "bg-[var(--sidebar-active)] text-[var(--text)]"
                        : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]"
                    }`}
                    onClick={() => onSelectChat(chat.id)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-medium">
                      {chat.title}
                    </span>
                  </button>
                  <button
                    aria-label={`Удалить чат: ${chat.title}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted)] opacity-100 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                    onClick={() => onDeleteChat(chat.id)}
                    title="Удалить"
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-[var(--sidebar-border)] p-3">
          {isSettingsOpen ? (
            <div className="mb-3 rounded-lg border border-[var(--sidebar-border)] bg-[var(--settings-bg)] p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text)]">
                  Настройки
                </p>
                <button
                  className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
                  onClick={onCloseSettings}
                  type="button"
                >
                  Готово
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--settings-row)] p-2.5">
                <span className="text-sm text-[var(--text)]">Тема</span>
                <ThemeSwitch onToggle={onToggleTheme} theme={theme} />
              </div>
              <button
                className="mt-2 flex h-10 w-full items-center justify-center rounded-lg border border-[var(--danger-border)] text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger-soft)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
                onClick={onClearAllChats}
                type="button"
              >
                Очистить все чаты
              </button>
            </div>
          ) : null}

          <button
            className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] ${
              isSettingsOpen
                ? "bg-[var(--sidebar-active)] text-[var(--text)]"
                : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]"
            }`}
            onClick={onToggleSettings}
            type="button"
          >
            <SettingsIcon />
            <span>Настройки</span>
          </button>
        </div>
      </aside>
    </>
  );
}
