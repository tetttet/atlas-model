"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { productBrand } from "@/lib/admissions/brand";
import { welcomeBackdropSubtext, welcomeBackdropText } from "./chat-data";
import type { ChatMessage } from "./chat-types";

type ChatMessagesProps = {
  isLoading: boolean;
  messages: ChatMessage[];
  onTypingComplete?: (messageId: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  typingMessageId?: string | null;
};

const urlPattern = /https?:\/\/[^\s]+/g;
const urlAtCursorPattern = /^https?:\/\/[^\s]+/;
const orderedListPattern = /^\s*(\d+)[.)]\s+(.*)$/;
const unorderedListPattern = /^\s*[-*•]\s+(.*)$/;
const messageTextLinkClassName =
  "break-all font-bold underline decoration-2 underline-offset-4 transition hover:text-[var(--accent)]";

type MessageBlock =
  | {
      lines: string[];
      type: "paragraph";
    }
  | {
      items: string[];
      start: number;
      type: "ordered";
    }
  | {
      items: string[];
      type: "unordered";
    };

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function isSafeMessageHref(href: string) {
  return isExternalHref(href) || href.startsWith("/") || href.startsWith("#");
}

function splitTrailingPunctuation(value: string) {
  const match = value.match(/[),.;!?]+$/);

  if (!match) {
    return { href: value, trailing: "" };
  }

  return {
    href: value.slice(0, -match[0].length),
    trailing: match[0],
  };
}

function parseMessageBlocks(content: string) {
  const blocks: MessageBlock[] = [];
  const paragraphLines: string[] = [];
  let activeList:
    | Extract<MessageBlock, { type: "ordered" | "unordered" }>
    | null = null;

  function flushParagraph() {
    if (!paragraphLines.length) {
      return;
    }

    blocks.push({ lines: [...paragraphLines], type: "paragraph" });
    paragraphLines.length = 0;
  }

  function flushList() {
    if (!activeList) {
      return;
    }

    blocks.push(activeList);
    activeList = null;
  }

  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    const orderedMatch = line.match(orderedListPattern);
    const unorderedMatch = line.match(unorderedListPattern);

    if (orderedMatch) {
      flushParagraph();

      if (activeList?.type !== "ordered") {
        flushList();
        activeList = {
          items: [],
          start: Number(orderedMatch[1]),
          type: "ordered",
        };
      }

      activeList.items.push(orderedMatch[2]);
      continue;
    }

    if (unorderedMatch) {
      flushParagraph();

      if (activeList?.type !== "unordered") {
        flushList();
        activeList = { items: [], type: "unordered" };
      }

      activeList.items.push(unorderedMatch[1]);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    if (activeList && /^\s+\S/.test(line)) {
      activeList.items[activeList.items.length - 1] += `\n${line.trim()}`;
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function parseMarkdownLink(value: string) {
  if (!value.startsWith("[")) {
    return null;
  }

  const labelEnd = value.indexOf("](");

  if (labelEnd <= 1) {
    return null;
  }

  const hrefEnd = value.indexOf(")", labelEnd + 2);

  if (hrefEnd === -1) {
    return null;
  }

  const href = value.slice(labelEnd + 2, hrefEnd).trim();

  if (!isSafeMessageHref(href)) {
    return null;
  }

  return {
    href,
    label: value.slice(1, labelEnd),
    length: hrefEnd + 1,
  };
}

function renderInlineMarkdown(content: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const marker = content.slice(cursor, cursor + 2);

    if (marker === "**" || marker === "__") {
      const end = content.indexOf(marker, cursor + marker.length);
      const strongText =
        end === -1
          ? content.slice(cursor + marker.length)
          : content.slice(cursor + marker.length, end);

      if (strongText) {
        nodes.push(
          <strong
            className="font-semibold"
            key={`${keyPrefix}-strong-${cursor}`}
          >
            {renderInlineMarkdown(strongText, `${keyPrefix}-strong-${cursor}`)}
          </strong>,
        );
      }

      cursor = end === -1 ? content.length : end + marker.length;
      continue;
    }

    const markdownLink = parseMarkdownLink(content.slice(cursor));

    if (markdownLink) {
      nodes.push(
        <MessageLink
          className={messageTextLinkClassName}
          href={markdownLink.href}
          key={`${keyPrefix}-markdown-link-${cursor}`}
        >
          {renderInlineMarkdown(
            markdownLink.label,
            `${keyPrefix}-markdown-link-${cursor}`,
          )}
        </MessageLink>,
      );
      cursor += markdownLink.length;
      continue;
    }

    const urlMatch = content.slice(cursor).match(urlAtCursorPattern);

    if (urlMatch) {
      const rawUrl = urlMatch[0];
      const { href, trailing } = splitTrailingPunctuation(rawUrl);

      nodes.push(
        <a
          className={messageTextLinkClassName}
          href={href}
          key={`${keyPrefix}-url-${cursor}`}
          rel="noreferrer"
          target="_blank"
        >
          {href}
        </a>,
      );

      if (trailing) {
        nodes.push(trailing);
      }

      cursor += rawUrl.length;
      continue;
    }

    const nextSpecialIndexes = [
      content.indexOf("**", cursor),
      content.indexOf("__", cursor),
      content.indexOf("[", cursor),
      content.slice(cursor + 1).search(urlPattern) === -1
        ? -1
        : cursor + 1 + content.slice(cursor + 1).search(urlPattern),
    ].filter((index) => index > cursor);

    const nextCursor = nextSpecialIndexes.length
      ? Math.min(...nextSpecialIndexes)
      : content.length;

    nodes.push(content.slice(cursor, nextCursor));
    cursor = nextCursor;
  }

  return nodes;
}

function renderInlineMarkdownWithBreaks(
  content: string,
  keyPrefix: string,
  trailingNode?: ReactNode,
) {
  const nodes: ReactNode[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    if (index > 0) {
      nodes.push(<br key={`${keyPrefix}-br-${index}`} />);
    }

    nodes.push(...renderInlineMarkdown(line, `${keyPrefix}-line-${index}`));
  });

  if (trailingNode) {
    nodes.push(
      <Fragment key={`${keyPrefix}-trailing`}>{trailingNode}</Fragment>,
    );
  }

  return nodes;
}

function renderMessageContent(content: string, trailingNode?: ReactNode) {
  const blocks = parseMessageBlocks(content);

  if (!blocks.length) {
    return trailingNode ? <span>{trailingNode}</span> : null;
  }

  return blocks.map((block, blockIndex) => {
    const isLastBlock = blockIndex === blocks.length - 1;

    if (block.type === "paragraph") {
      return (
        <p className="whitespace-pre-wrap" key={`paragraph-${blockIndex}`}>
          {renderInlineMarkdownWithBreaks(
            block.lines.join("\n"),
            `paragraph-${blockIndex}`,
            isLastBlock ? trailingNode : undefined,
          )}
        </p>
      );
    }

    const ListTag = block.type === "ordered" ? "ol" : "ul";
    const markerClassName =
      block.type === "ordered" ? "list-decimal" : "list-disc";

    return (
      <ListTag
        className={`ml-5 space-y-1 ${markerClassName} marker:font-semibold marker:text-current`}
        key={`${block.type}-${blockIndex}`}
        start={block.type === "ordered" ? block.start : undefined}
      >
        {block.items.map((item, itemIndex) => (
          <li className="pl-1" key={`${block.type}-${blockIndex}-${itemIndex}`}>
            {renderInlineMarkdownWithBreaks(
              item,
              `${block.type}-${blockIndex}-${itemIndex}`,
              isLastBlock && itemIndex === block.items.length - 1
                ? trailingNode
                : undefined,
            )}
          </li>
        ))}
      </ListTag>
    );
  });
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);

    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  return prefersReducedMotion;
}

type TypewriterTextProps = {
  isActive: boolean;
  messageId: string;
  onComplete: (messageId: string) => void;
  onFrame: () => void;
  prefersReducedMotion: boolean;
  text: string;
};

function TypewriterText({
  isActive,
  messageId,
  onComplete,
  onFrame,
  prefersReducedMotion,
  text,
}: TypewriterTextProps) {
  const [visibleText, setVisibleText] = useState(() => (isActive ? "" : text));

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (prefersReducedMotion) {
      onComplete(messageId);
      return;
    }

    let index = 0;
    const step = text.length > 700 ? 7 : text.length > 320 ? 5 : 3;
    const intervalId = window.setInterval(() => {
      index = Math.min(text.length, index + step);
      setVisibleText(text.slice(0, index));
      onFrame();

      if (index >= text.length) {
        window.clearInterval(intervalId);
        onComplete(messageId);
      }
    }, 16);

    return () => window.clearInterval(intervalId);
  }, [isActive, messageId, onComplete, onFrame, prefersReducedMotion, text]);

  const renderedText = isActive && !prefersReducedMotion ? visibleText : text;
  const caret =
    isActive && !prefersReducedMotion ? (
      <span
        aria-hidden="true"
        className="chat-type-caret ml-0.5 inline-block"
      />
    ) : undefined;

  return (
    <div className="space-y-2 break-words">
      {renderMessageContent(renderedText, caret)}
    </div>
  );
}

type MessageLinkProps = {
  children: ReactNode;
  className: string;
  href: string;
};

function MessageLink({ children, className, href }: MessageLinkProps) {
  if (isExternalHref(href)) {
    return (
      <a className={className} href={href} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

export function ChatMessages({
  isLoading,
  messages,
  onTypingComplete,
  scrollRef,
  typingMessageId,
}: ChatMessagesProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const scrollToBottom = useCallback(() => {
    const scrollContainer = scrollRef.current;

    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [scrollRef]);

  const handleTypingComplete = useCallback(
    (messageId: string) => {
      onTypingComplete?.(messageId);
    },
    [onTypingComplete],
  );

  return (
    <div
      className="relative min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--chat-bg)] px-4 py-5 transition-colors duration-300 sm:px-6"
      ref={scrollRef}
    >
      {messages.length === 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid select-none place-items-center px-6 text-center"
        >
          <div className="space-y-2">
            <p className="text-4xl font-semibold leading-none text-[var(--welcome-backdrop-text)] sm:text-6xl">
              {welcomeBackdropText}
            </p>
            <p className="text-2xl font-medium leading-none text-[var(--welcome-backdrop-text)] sm:text-4xl">
              {welcomeBackdropSubtext}
            </p>
          </div>
        </div>
      ) : null}

      {messages.map((message) => {
        const isTyping =
          message.role === "assistant" && message.id === typingMessageId;

        return (
          <article
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
            key={message.id}
          >
            <div
              className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 transition-colors duration-300 sm:max-w-[78%] ${
                message.role === "user"
                  ? "bg-[var(--user-bubble)] text-[var(--user-bubble-text)]"
                  : "text-[var(--assistant-bubble-text)]"
              }`}
            >
              <TypewriterText
                isActive={isTyping}
                messageId={message.id}
                onComplete={handleTypingComplete}
                onFrame={scrollToBottom}
                prefersReducedMotion={prefersReducedMotion}
                text={message.content}
              />

              {!isTyping && message.reply?.links?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.reply.links.map((link) => (
                    <MessageLink
                      className="select-none rounded-full bg-[var(--link-chip-bg)] px-3 py-1.5 text-xs font-medium text-[var(--link-chip-text)] transition hover:bg-[var(--link-chip-hover)]"
                      href={link.href}
                      key={link.href}
                    >
                      {link.label}
                    </MessageLink>
                  ))}
                </div>
              ) : null}

              {!isTyping && message.reply?.actions?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.reply.actions.map((action) => (
                    <MessageLink
                      className="select-none rounded-full bg-[var(--action-bg)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--action-hover)]"
                      href={action.href ?? productBrand.consultationPath}
                      key={`${action.label}-${action.href}`}
                    >
                      {action.label}
                    </MessageLink>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}

      {isLoading ? (
        <div className="flex justify-start">
          <div
            aria-label="Ассистент печатает ответ"
            className="rounded-[22px] border border-[var(--bubble-border)] bg-[var(--assistant-bubble)] px-4 py-3 text-sm text-[var(--muted)] shadow-sm"
            role="status"
          >
            <span aria-hidden="true" className="flex h-6 items-center gap-1.5">
              <span className="chat-typing-dot block h-2 w-2 rounded-full bg-[var(--muted)]" />
              <span className="chat-typing-dot block h-2 w-2 rounded-full bg-[var(--muted)]" />
              <span className="chat-typing-dot block h-2 w-2 rounded-full bg-[var(--muted)]" />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
