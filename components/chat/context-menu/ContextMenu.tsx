"use client";

import { useEffect, useRef, useState } from "react";
import {
  Reply,
  Copy,
  Star,
  StarOff,
  Forward,
  Pencil,
  Trash2,
  Trash,
  Plus,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";

const MINE_ACTIONS = [
  { id: "reply", label: "Reply", icon: Reply, danger: false },
  { id: "copy", label: "Copy", icon: Copy, danger: false },
  { id: "star", label: "Star", icon: Star, danger: false },
  { id: "forward", label: "Forward", icon: Forward, danger: false },
  { id: "edit", label: "Edit", icon: Pencil, danger: false },
  { id: "delete_me", label: "Delete for me", icon: Trash, danger: false },
  {
    id: "delete_all",
    label: "Delete for everyone",
    icon: Trash2,
    danger: true,
  },
] as const;

const OTHER_ACTIONS = [
  { id: "reply", label: "Reply", icon: Reply, danger: false },
  { id: "copy", label: "Copy", icon: Copy, danger: false },
  { id: "star", label: "Star", icon: Star, danger: false },
  { id: "forward", label: "Forward", icon: Forward, danger: false },
  { id: "delete_me", label: "Delete for me", icon: Trash, danger: false },
] as const;

export default function ContextMenu() {
  const { contextMenu, setContextMenu, handleAction, handeleAddReaction } =
    useChatStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [setContextMenu]);

  if (!contextMenu) return null;

  const { msg, isMine, position } = contextMenu;
  const actions = isMine ? MINE_ACTIONS : OTHER_ACTIONS;

  const style = position.flip
    ? { bottom: window.innerHeight - position.y, left: position.x }
    : { top: position.y, left: position.x };

  return (
    <div
      ref={menuRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ ...style, position: "fixed", zIndex: 9999 }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-600 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {showPicker ? (
        <div className="animate-in fade-in zoom-in-95 duration-150">
          <EmojiPicker
            emojiStyle={EmojiStyle.NATIVE}
            onEmojiClick={(emojiData) => {
              handeleAddReaction(msg, emojiData.emoji);
              setContextMenu(null);
            }}
            theme={Theme.AUTO}
            width={300}
            height={380}
            searchPlaceHolder="Search emojis..."
          />
        </div>
      ) : (
        <div className="w-56">
          <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
            {["👍", "❤️", "😂", "😮", "😢"].map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handeleAddReaction(msg, emoji);
                  setContextMenu(null);
                }}
                className="text-xl hover:scale-125 transition-transform duration-200 focus:outline-none"
                title="React"
              >
                {emoji}
              </button>
            ))}

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPicker(true);
              }}
              className="h-7 w-7 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              title="More emojis"
            >
              <Plus className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          <div className="py-1">
            {actions.map(({ id, label, icon: Icon, danger }, i) => {
              const isStarAction = id === "star";
              const displayLabel = isStarAction
                ? msg.isImportant
                  ? "Unstar"
                  : "Star"
                : label;
              const DisplayIcon = isStarAction
                ? msg.isImportant
                  ? StarOff
                  : Star
                : Icon;

              return (
                <button
                  key={id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(id, msg);
                    setContextMenu(null);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                    (danger as boolean)
                      ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
                    i > 0 &&
                      id === "delete_me" &&
                      "border-t border-slate-100 mt-1 pt-2 dark:border-slate-700",
                  )}
                >
                  <DisplayIcon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isStarAction && !msg.isImportant && "text-amber-500",
                      isStarAction && msg.isImportant && "text-slate-400",
                    )}
                  />
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
