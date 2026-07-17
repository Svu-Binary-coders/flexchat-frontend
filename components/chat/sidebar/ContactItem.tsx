"use client";

import { Contact } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { timeFormatFn } from "@/lib/dateHelper";
import { useAppearanceStore } from "@/stores/appearanceStore";
import { useChatStore } from "@/stores/chatStore";
import { MoreVertical, Pin, Trash2, Ban, Star, Lock } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useLockChat } from "@/hooks/useChatAction";
import { getNameFallback } from "@/utils/getNameFallback";

interface ContactItemProps {
  contact: Contact;
  isActive: boolean;
  onClick: () => void;
  // Actions
  onPin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onBlock?: (id: string) => void;
}

export default function ContactItem({
  contact,
  isActive,
  onClick,
  onDelete,
  onBlock,
}: ContactItemProps) {
  const { timeFormat } = useAppearanceStore();
  const { togglePin, toggleFavorite } = useChatStore();
  const { mutate: chatLock } = useLockChat(contact.customChatId as string);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={onClick}
          className={cn(
            "w-full flex items-center gap-3 sm:gap-3.5 px-3 sm:px-4 py-3 sm:py-3.5 text-left transition-all duration-200 outline-none relative group cursor-pointer",
            "hover:bg-sky-50 dark:hover:bg-slate-800/60",
            isActive
              ? "bg-sky-100/80 dark:bg-sky-500/10 border-l-[3px] border-sky-600 dark:border-sky-500"
              : "bg-transparent border-l-[3px] border-transparent hover:border-sky-300 dark:hover:border-slate-600",
          )}
        >
          {/* Avatar Section */}
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 sm:h-11 sm:w-11 border border-slate-200/50 dark:border-slate-700 shadow-sm transition-transform duration-200 group-hover:scale-105">
              <AvatarImage src={contact.profile_image} alt={contact.name} />
              <AvatarFallback className="bg-gradient-to-br from-sky-400 to-blue-600 text-white text-sm font-bold">
                {getNameFallback(contact.name)}
              </AvatarFallback>
            </Avatar>
            {contact.isOnline && (
              <span
                className={cn(
                  "absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-500",
                  "ring-2 ring-white dark:ring-slate-900 shadow-sm",
                )}
              />
            )}
          </div>

          {/* Info Container */}
          <div className="flex-1 flex flex-col justify-center min-w-0 pr-8">
            {/* Top Row: Name & Time */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    "text-[15px] sm:text-sm truncate transition-colors",
                    contact.unreadCount
                      ? "font-bold text-slate-900 dark:text-slate-50"
                      : "font-semibold text-slate-700 dark:text-slate-200",
                    isActive && "text-sky-700 dark:text-sky-400",
                  )}
                >
                  {contact.name}
                </span>

                {contact.isPinned && (
                  <Pin className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500 fill-slate-400/20" />
                )}

                {contact.isFavorite && (
                  <Star className="h-3.5 w-3.5 shrink-0 text-amber-400 fill-amber-400" />
                )}
              </div>

              {contact.lastMessage?.createdAt && (
                <span
                  className={cn(
                    "text-[10px] sm:text-[11px] shrink-0 font-medium",
                    contact.unreadCount
                      ? "text-sky-600 dark:text-sky-400 font-bold"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {timeFormatFn(contact.lastMessage.createdAt, timeFormat)}
                </span>
              )}
            </div>

            {/* Bottom Row: Message & Unread Badge */}
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "text-[13px] sm:text-xs truncate transition-colors flex-1",
                  contact.unreadCount
                    ? "text-slate-800 dark:text-slate-300 font-medium"
                    : "text-slate-500 dark:text-slate-500/80",
                )}
              >
                {contact.lastMessage?.content ?? "No messages yet"}
              </span>

              {!!contact.unreadCount && (
                <span
                  className={cn(
                    "shrink-0 h-5 min-w-[20px] px-1.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-sm",
                    "bg-sky-500 animate-in zoom-in-75 duration-200",
                  )}
                >
                  {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
                </span>
              )}
            </div>
          </div>

          {/* Action Menu (3 Dots) */}
          <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 shadow-sm sm:bg-transparent sm:shadow-none hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all outline-none backdrop-blur-sm"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-48 py-2 px-1 dark:bg-slate-900 dark:border-slate-800 z-50"
              >
                {/* Pinned Toggle Menu Item */}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin?.(contact.customChatId as string);
                  }}
                  className="cursor-pointer gap-2 focus:bg-slate-100 dark:focus:bg-slate-800"
                >
                  <Pin
                    className={cn(
                      "h-4 w-4 transition-colors",
                      contact.isPinned
                        ? "text-slate-700 dark:text-slate-200 fill-slate-700 dark:fill-slate-200"
                        : "text-slate-500",
                    )}
                  />
                  <span>{contact.isPinned ? "Unpin Chat" : "Pin Chat"}</span>
                </DropdownMenuItem>

                {/*  Favorite Toggle Menu Item */}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite?.(contact.customChatId as string);
                  }}
                  className="cursor-pointer gap-2 focus:bg-slate-100 dark:focus:bg-slate-800"
                >
                  <Star
                    className={cn(
                      "h-4 w-4 transition-colors",
                      contact.isFavorite
                        ? "text-amber-500 fill-amber-500"
                        : "text-slate-500",
                    )}
                  />
                  <span>
                    {contact.isFavorite
                      ? "Remove from Favorites"
                      : "Add to Favorites"}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    chatLock();
                  }}
                  className="cursor-pointer gap-2 focus:bg-slate-100 dark:focus:bg-slate-800"
                >
                  <Lock className="h-4 w-4 text-slate-500" />
                  <span className="capitalize">chat lock</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="dark:bg-slate-800" />

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onBlock?.(contact.id);
                  }}
                  className="cursor-pointer gap-2 text-orange-600 focus:bg-orange-100 focus:text-orange-700 dark:text-orange-500 dark:focus:bg-orange-950/50 dark:focus:text-orange-400 transition-colors"
                >
                  <Ban className="h-4 w-4" />
                  <span>Block User</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(contact.id);
                  }}
                  className="cursor-pointer gap-2 text-red-600 focus:bg-red-100 focus:text-red-700 dark:text-red-500 dark:focus:bg-red-950/50 dark:focus:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Chat</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Context Menu Content (Long Press / Right Click) */}
      <ContextMenuContent className="w-48 dark:bg-slate-900 dark:border-slate-800 z-50 p-2">
        {/* Pinned Toggle Context Item */}
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            togglePin?.(contact.customChatId as string);
          }}
          className="cursor-pointer gap-2 focus:bg-slate-100 dark:focus:bg-slate-800"
        >
          <Pin
            className={cn(
              "h-4 w-4 transition-colors",
              contact.isPinned
                ? "text-slate-700 dark:text-slate-200 fill-slate-700 dark:fill-slate-200"
                : "text-slate-500",
            )}
          />
          <span>{contact.isPinned ? "Unpin Chat" : "Pin Chat"}</span>
        </ContextMenuItem>

        {/* 🔴 Favorite Toggle Context Item */}
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite?.(contact.customChatId as string);
          }}
          className="cursor-pointer gap-2 focus:bg-slate-100 dark:focus:bg-slate-800"
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              contact.isFavorite
                ? "text-amber-500 fill-amber-500"
                : "text-slate-500",
            )}
          />
          <span>
            {contact.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          </span>
        </ContextMenuItem>

        <ContextMenuSeparator className="dark:bg-slate-800" />

        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onBlock?.(contact.id);
          }}
          className="cursor-pointer gap-2 text-orange-600 focus:bg-orange-100 focus:text-orange-700 dark:text-orange-500 dark:focus:bg-orange-950/50 dark:focus:text-orange-400 transition-colors"
        >
          <Ban className="h-4 w-4" />
          <span>Block User</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(contact.id);
          }}
          className="cursor-pointer gap-2 text-red-600 focus:bg-red-100 focus:text-red-700 dark:text-red-500 dark:focus:bg-red-950/50 dark:focus:text-red-400 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Chat</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
