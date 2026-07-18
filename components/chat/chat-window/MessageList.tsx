/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { groupMessagesByDate } from "@/utils/date";
import MessageBubble from "./MessageBubble";
import DateDivider from "./DateDivider";
import TypingIndicator from "./TypingIndicator";
import { MessageSquare, Loader2, ChevronDown } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useAppearanceStore } from "@/stores/appearanceStore";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import Image from "next/image";

const NEAR_BOTTOM_PX = 150;
const SHOW_BTN_PX = 250;

export default function MessageList() {
  const { messages, activeContact } = useChatStore();
  const { wallpaper, compactMode } = useAppearanceStore();
  const { myId } = useAuthStore();

  const {
    isLoading: msgLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useChatHistory(myId, activeContact?.customChatId, activeContact?.id);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const prevLengthRef = useRef(0);
  const isFirstLoadRef = useRef(true);
  const isFetchingRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const isPaginatingRef = useRef(false);

  const [showScrollButton, setShowScrollButton] = useState(false);

  //  scrollToBottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior });
      setShowScrollButton(false);
    });
  }, []);

  //  1. Chat switch reset
  useEffect(() => {
    isFirstLoadRef.current = true;
    prevLengthRef.current = 0;
    isNearBottomRef.current = true;
    const rafId = requestAnimationFrame(() => {
      setShowScrollButton(false);
    });

    return () => cancelAnimationFrame(rafId);
  }, [activeContact?.id]);
  // intial load , we want to scroll to bottom only after the messages are loaded. If we scroll before loading, it might scroll to the wrong position because the messages haven't been rendered yet, which can cause the scroll to jump around or not reach the bottom. By adding msgLoading as a dependency and checking it before scrolling, we ensure that we only scroll to the bottom once the messages are fully loaded and rendered in the store.
  useEffect(() => {
    if (!messages.length) return;
    if (!isFirstLoadRef.current) return;
    if (msgLoading) return; // if messages are still loading, we don't want to scroll yet because the messages might not be fully loaded in the store, which can cause the scroll to jump around or not reach the bottom. We'll wait for the loading to finish and let the next effect handle the scrolling.
    isFirstLoadRef.current = false;
    prevLengthRef.current = messages.length;
    scrollToBottom("instant");
  }, [messages.length, activeContact?.id, msgLoading, scrollToBottom]);

  //  3. New message arrived
  useEffect(() => {
    if (isFirstLoadRef.current) return;
    // if we're currently paginating (fetching older messages), we don't want to auto-scroll to bottom when new messages arrive, because it can disrupt the user's position. Instead, we just update the prevLengthRef and let the pagination effect handle the scroll position after loading is done.
    if (isPaginatingRef.current) {
      prevLengthRef.current = messages.length;
      return;
    }

    const added = messages.length - prevLengthRef.current;
    if (added <= 0) return;
    prevLengthRef.current = messages.length;

    const lastMsg = messages[messages.length - 1];
    const isMyMsg = (lastMsg as any)?.senderId === myId;
    const isOptimistic = !!(lastMsg as any)?.isTemp;

    if (isMyMsg || isOptimistic || isNearBottomRef.current) {
      scrollToBottom("smooth");
    } else {
      // if new messages arrive and the user is not near the bottom, we show the scroll button to indicate that there are new messages and allow them to quickly jump to the latest message. We use a small timeout to ensure that the state update happens after any potential layout shifts caused by new messages being rendered, which can help prevent janky behavior with the scroll button appearing/disappearing too quickly.
      setTimeout(() => setShowScrollButton(true), 0);
    }
  }, [messages, myId, scrollToBottom]);

  //  4. Restore position after pagination
  useEffect(() => {
    if (isFetchingNextPage) return;
    const el = scrollContainerRef.current;
    if (!el || !prevScrollHeightRef.current) return;
    el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
    prevScrollHeightRef.current = 0;
  }, [isFetchingNextPage]);

  //  Scroll handler
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distFromBottom <= NEAR_BOTTOM_PX;
    setShowScrollButton(distFromBottom > SHOW_BTN_PX);

    if (
      el.scrollTop < 80 &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isFetchingRef.current
    ) {
      isFetchingRef.current = true;
      isPaginatingRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      fetchNextPage().finally(() => {
        isFetchingRef.current = false;
        // small delay: messages state update, clear pagination flag, and scroll position adjustment are all happening around the same time after pagination, so to prevent any potential race conditions or janky behavior, we add a small timeout to ensure that the pagination flag is cleared after all the related updates are done. This helps ensure a smoother user experience when loading older messages.
        setTimeout(() => {
          isPaginatingRef.current = false;
        }, 100);
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  //  Wallpaper
  const wallpaperBg =
    wallpaper === "gradient1"
      ? "bg-linear-to-br from-sky-100 to-blue-50 dark:from-sky-900 dark:to-slate-900"
      : wallpaper === "gradient2"
        ? "bg-linear-to-br from-rose-100 to-pink-50 dark:from-rose-900 dark:to-slate-900"
        : wallpaper === "gradient3"
          ? "bg-linear-to-br from-emerald-100 to-teal-50 dark:from-emerald-900 dark:to-slate-900"
          : "bg-white dark:bg-[#0b141a]";

  const wallpaperStyle: React.CSSProperties =
    wallpaper === "dots"
      ? {
          backgroundImage:
            "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }
      : wallpaper === "grid"
        ? {
            backgroundImage:
              "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }
        : {};

  //  Renders
  if (msgLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#0b141a]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 transition-colors duration-300",
          wallpaperBg,
        )}
        style={wallpaperStyle}
      >
        <div className="h-14 w-14 rounded-2xl bg-white/20 dark:bg-slate-800/50 backdrop-blur-md flex items-center justify-center shadow-sm border border-white/20">
          <MessageSquare className="h-7 w-7 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
          No messages yet
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Send a message to start the conversation
        </p>
      </div>
    );
  }

  const grouped = groupMessagesByDate(messages);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 transition-colors duration-300",
          wallpaperBg,
        )}
        style={wallpaperStyle}
      >
        {isFetchingNextPage && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          </div>
        )}

        {!hasNextPage && messages.length > 0 && (
          <p className="text-center text-xs text-slate-400 dark:text-slate-600 py-3">
            Beginning of conversation
          </p>
        )}

        <div
          className={cn(
            "flex flex-col px-5 py-4",
            compactMode ? "gap-0.5" : "gap-1.5",
          )}
        >
          {grouped.map((group) => (
            <div key={group.label} className="flex flex-col">
              <DateDivider label={group.label} />
              <div
                className={cn(
                  "flex flex-col",
                  compactMode ? "gap-0.5" : "gap-1.5",
                )}
              >
                {group.messages.map((msg, index) => {
                  const isMyMessage = msg.senderId === myId;
                  const isGroup = activeContact?.isGroupChat;

                  const prevMsg = group.messages[index - 1];
                  const nextMsg = group.messages[index + 1];

                  const isFirstInChain =
                    !prevMsg || prevMsg.senderId !== msg.senderId;
                  const isLastInChain =
                    !nextMsg || nextMsg.senderId !== msg.senderId;

                  return (
                    <div
                      key={msg._id}
                      className={cn(
                        "flex items-start gap-2",
                        isMyMessage ? "flex-row-reverse" : "flex-row",
                      )}
                    >
                      {isGroup && !isMyMessage && (
                        <div className="w-7 h-7 flex-shrink-0 mt-1">
                          {isFirstInChain ? (
                            <Image
                              src={
                                msg.senderDetails?.profilePicture ||
                                "/default-avatar.png"
                              }
                              alt={msg.senderDetails?.userName || "user"}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7" />
                          )}
                        </div>
                      )}

                      {/*  Message + Name  */}
                      <div
                        className={cn(
                          "flex flex-col max-w-[70%]",
                          isMyMessage ? "items-end" : "items-start",
                        )}
                      >
                        {/* Name — first message এ */}
                        {isGroup && !isMyMessage && isFirstInChain && (
                          <span className="text-xs font-medium text-blue-500 dark:text-blue-400 ml-1 mb-0.5">
                            {msg.senderDetails?.userName}
                          </span>
                        )}

                        <MessageBubble message={msg} />
                      </div>

                      {isGroup && isMyMessage && (
                        <div className="w-7 h-7 flex-shrink-0 mt-1">
                          {isFirstInChain ? (
                            <img
                              src={
                                msg.senderDetails?.profilePicture ||
                                "/default-avatar.png"
                              }
                              alt="me"
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <TypingIndicator />
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {/* Floating scroll-to-bottom button */}
      <button
        onClick={() => scrollToBottom("smooth")}
        aria-label="Scroll to latest"
        className={cn(
          "absolute bottom-4 right-5 z-50 h-10 w-10 rounded-full",
          "bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700",
          "flex items-center justify-center text-slate-600 dark:text-slate-300",
          "hover:bg-slate-50 dark:hover:bg-slate-700",
          "transition-all duration-200 ease-out",
          showScrollButton
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-3 pointer-events-none",
        )}
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
}
