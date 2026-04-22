"use client";

import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SendIcon } from "./icons";

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SHEET_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const SCROLL_TRIGGER_DELTA = 8;

type ChatComposerProps = {
  activeError: string;
  chips: string[];
  input: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isDisabled: boolean;
  onChangeInput: (value: string) => void;
  onChipClick: (chip: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
};

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function ChatComposer({
  activeError,
  chips,
  input,
  inputRef,
  isDisabled,
  onChangeInput,
  onChipClick,
  onSubmit,
  scrollRef,
}: ChatComposerProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(true);
  const [composerHeight, setComposerHeight] = useState<number | null>(null);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sending, setSending] = useState(false);

  const composerInnerRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const dragStartProgressRef = useRef(1);
  const dragDeltaRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const currentProgressRef = useRef(1);
  const ignoreScrollUntilRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isComposerOpenRef = useRef(isComposerOpen);
  const lastScrollTopRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const sendTimerRef = useRef<number | null>(null);

  const visibleProgress = dragProgress ?? (isComposerOpen ? 1 : 0);
  const measuredHeight = composerHeight ?? 0;
  const resolvedHeight =
    composerHeight === null
      ? undefined
      : Math.max(0, measuredHeight * visibleProgress);
  const sheetOpacity = clampProgress(visibleProgress * 1.25);
  const isFullyCollapsed = visibleProgress < 0.04;

  const setComposerOpen = useCallback((nextOpen: boolean) => {
    ignoreScrollUntilRef.current = window.performance.now() + 220;
    currentProgressRef.current = nextOpen ? 1 : 0;
    setDragProgress(null);
    setIsComposerOpen(nextOpen);
  }, []);

  useEffect(() => {
    isComposerOpenRef.current = isComposerOpen;
  }, [isComposerOpen]);

  useEffect(() => {
    return () => {
      if (sendTimerRef.current !== null) {
        window.clearTimeout(sendTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = composerInnerRef.current;

    if (!node) {
      return;
    }

    const measure = () => {
      setComposerHeight(node.offsetHeight + 1);
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, [activeError, chips]);

  useEffect(() => {
    const scroller = scrollRef.current;

    if (!scroller) {
      return;
    }

    lastScrollTopRef.current = scroller.scrollTop;

    const onScroll = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;

        if (isDraggingRef.current) {
          return;
        }

        const currentScrollTop = scroller.scrollTop;

        if (window.performance.now() < ignoreScrollUntilRef.current) {
          lastScrollTopRef.current = currentScrollTop;
          return;
        }

        const delta = currentScrollTop - lastScrollTopRef.current;
        lastScrollTopRef.current = currentScrollTop;

        if (Math.abs(delta) < SCROLL_TRIGGER_DELTA) {
          return;
        }

        const inputIsFocused = document.activeElement === inputRef.current;

        if (
          delta < 0 &&
          currentScrollTop > 4 &&
          isComposerOpenRef.current &&
          !inputIsFocused
        ) {
          setComposerOpen(false);
          return;
        }

        if (delta > 0 && !isComposerOpenRef.current) {
          setComposerOpen(true);
        }
      });
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", onScroll);

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [inputRef, scrollRef, setComposerOpen]);

  const startDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      activePointerIdRef.current = event.pointerId;
      dragStartYRef.current = event.clientY;
      dragStartProgressRef.current = visibleProgress;
      currentProgressRef.current = visibleProgress;
      dragDeltaRef.current = 0;
      hasDraggedRef.current = false;
      isDraggingRef.current = true;
      setIsDragging(true);
      setDragProgress(visibleProgress);
    },
    [visibleProgress],
  );

  const moveDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      const delta = dragStartYRef.current - event.clientY;
      const distance = Math.max(104, measuredHeight || 180);
      const nextProgress = clampProgress(
        dragStartProgressRef.current + delta / distance,
      );

      dragDeltaRef.current = delta;
      currentProgressRef.current = nextProgress;

      if (Math.abs(delta) > 4) {
        hasDraggedRef.current = true;
      }

      setDragProgress(nextProgress);
    },
    [measuredHeight],
  );

  const finishDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      const finalProgress = currentProgressRef.current;
      const finalDelta = dragDeltaRef.current;
      const shouldOpen =
        finalDelta > 34 || (finalDelta > -34 && finalProgress >= 0.5);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      ignoreNextClickRef.current = hasDraggedRef.current;
      activePointerIdRef.current = null;
      isDraggingRef.current = false;
      setIsDragging(false);
      setComposerOpen(shouldOpen);
    },
    [setComposerOpen],
  );

  const cancelDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      ignoreNextClickRef.current = hasDraggedRef.current;
      activePointerIdRef.current = null;
      isDraggingRef.current = false;
      setIsDragging(false);
      setComposerOpen(isComposerOpenRef.current);
    },
    [setComposerOpen],
  );

  const handleHandleClick = () => {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    setComposerOpen(!isComposerOpenRef.current);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setComposerOpen(true);
    setSending(true);

    if (sendTimerRef.current !== null) {
      window.clearTimeout(sendTimerRef.current);
    }

    sendTimerRef.current = window.setTimeout(() => {
      setSending(false);
      sendTimerRef.current = null;
    }, 600);

    onSubmit(event);
  };

  const handleInputFocus = () => {
    setComposerOpen(true);

    window.setTimeout(() => {
      const scroller = scrollRef.current;

      if (!scroller) {
        return;
      }

      scroller.scrollTo({
        top: scroller.scrollHeight,
        behavior: "smooth",
      });
    }, 250);
  };

  const handleChipClick = (
    chip: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const button = event.currentTarget;
    const ripple = document.createElement("span");

    ripple.className = "chip-ripple";
    ripple.style.cssText = `
      position:absolute;inset:0;border-radius:inherit;
      background:var(--accent);opacity:0.18;
      transform:scale(0);animation:chipRipple 0.4s ${EASE_OUT} forwards;
    `;

    button.style.position = "relative";
    button.style.overflow = "hidden";
    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
    onChipClick(chip);
  };

  const sheetStyle: CSSProperties = {
    borderColor: isFullyCollapsed ? "transparent" : "var(--border)",
    height: resolvedHeight,
    opacity: sheetOpacity,
    overflow: "hidden",
    pointerEvents: isFullyCollapsed ? "none" : "auto",
    transform: `translateY(${(1 - visibleProgress) * 18}px)`,
    transition: isDragging
      ? "none"
      : [
          `height 540ms ${SHEET_EASE}`,
          `opacity 320ms ${EASE_OUT}`,
          `transform 540ms ${SHEET_EASE}`,
          "border-color 220ms ease",
          "background-color 300ms ease",
        ].join(", "),
    willChange: "height, opacity, transform",
  };

  const contentStyle: CSSProperties = {
    opacity: clampProgress((visibleProgress - 0.08) / 0.62),
    transform: `translateY(${(1 - visibleProgress) * 10}px)`,
    transition: isDragging
      ? "none"
      : `opacity 360ms ${EASE_OUT}, transform 460ms ${SHEET_EASE}`,
  };

  const collapsedHandleStyle: CSSProperties = {
    opacity: isFullyCollapsed ? 1 : 0,
    pointerEvents: isFullyCollapsed ? "auto" : "none",
    transform: `translateY(${isFullyCollapsed ? 0 : 12}px)`,
    transition: `opacity 220ms ${EASE_OUT}, transform 360ms ${SHEET_EASE}`,
  };

  return (
    <>
      <style>{`
        @keyframes chipRipple {
          to { transform: scale(2.5); opacity: 0; }
        }
        @keyframes chipIn {
          from { opacity: 0; transform: translateY(8px) scale(0.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sendPop {
          0% { transform: scale(1); }
          40% { transform: scale(0.82); }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes errorIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chip-animated {
          animation: chipIn 0.35s ${SPRING} both;
        }
        .send-pop {
          animation: sendPop 0.5s ${SPRING} forwards !important;
        }
      `}</style>

      <div className="relative z-10 shrink-0">
        <footer
          aria-hidden={isFullyCollapsed}
          className="relative shrink-0 border-t bg-[var(--footer-bg)] transition-colors duration-300"
          inert={isFullyCollapsed ? true : undefined}
          style={sheetStyle}
        >
          <div
            className="px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 sm:px-5"
            ref={composerInnerRef}
            style={contentStyle}
          >
            <button
              aria-label={
                isComposerOpen
                  ? "Скрыть поле сообщения"
                  : "Открыть поле сообщения"
              }
              className="mx-auto mb-2 flex h-6 w-16 touch-none cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
              onClick={handleHandleClick}
              onPointerCancel={cancelDrag}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
              style={{ touchAction: "none" }}
              type="button"
            >
              <span
                aria-hidden="true"
                className="h-1 rounded-full bg-[var(--border)] transition-[background-color,width] duration-300"
                style={{ width: isComposerOpen ? 34 : 46 }}
              />
            </button>

            {chips.length > 0 ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {chips.map((chip, index) => (
                  <button
                    className="chip-animated shrink-0 select-none rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-medium text-[var(--chip-text)] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--chip-hover-bg)] hover:text-[var(--accent)] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isDisabled}
                    key={chip}
                    onClick={(event) => handleChipClick(chip, event)}
                    style={{ animationDelay: `${index * 35}ms` }}
                    type="button"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}

            <form className="flex items-end gap-2" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="chat-input">
                Вопрос о поступлении
              </label>

              <input
                autoComplete="off"
                autoCorrect="on"
                className="min-h-12 flex-1 rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-base text-[var(--text)] outline-none placeholder:text-[var(--placeholder)] transition-[background-color,border-color,box-shadow] duration-200 focus:border-[var(--accent)] focus:bg-[var(--input-focus-bg)] focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                disabled={isDisabled}
                enterKeyHint="send"
                id="chat-input"
                inputMode="text"
                maxLength={1200}
                onChange={(event) => onChangeInput(event.target.value)}
                onFocus={handleInputFocus}
                placeholder="Напишите вопрос о поступлении..."
                ref={inputRef}
                value={input}
              />

              <button
                aria-label="Отправить"
                className={`grid h-12 w-12 shrink-0 select-none place-items-center rounded-2xl bg-[var(--send-bg)] text-white focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--send-disabled)]${
                  sending ? " send-pop" : ""
                }`}
                disabled={isDisabled || !input.trim()}
                onMouseEnter={(event) => {
                  if (!isDisabled && input.trim()) {
                    event.currentTarget.style.transform =
                      "translateY(-2px) scale(1.06)";
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "";
                }}
                style={{
                  boxShadow:
                    !isDisabled && input.trim()
                      ? "0 4px 14px rgba(0,0,0,0.18)"
                      : "none",
                  transition: sending
                    ? "none"
                    : "background 0.2s, box-shadow 0.2s, opacity 0.2s, transform 0.2s",
                }}
                type="submit"
              >
                <span
                  style={{
                    display: "flex",
                    transform: sending ? "translateX(2px)" : "none",
                    transition: `transform 0.3s ${SPRING}`,
                  }}
                >
                  <SendIcon />
                </span>
              </button>
            </form>

            {activeError ? (
              <p
                className="mt-2 text-xs text-[var(--danger)]"
                role="alert"
                style={{ animation: `errorIn 0.3s ${EASE_OUT} both` }}
              >
                {activeError}
              </p>
            ) : null}
          </div>
        </footer>

        <button
          aria-label="Открыть поле сообщения"
          className="absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),0.45rem)] z-20 mx-auto flex h-10 w-24 touch-none cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
          onClick={handleHandleClick}
          onPointerCancel={cancelDrag}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          style={{
            ...collapsedHandleStyle,
            touchAction: "none",
          }}
          type="button"
        >
          <span
            aria-hidden="true"
            className="h-1 w-12 rounded-full bg-[var(--border)] shadow-sm"
          />
        </button>
      </div>
    </>
  );
}
