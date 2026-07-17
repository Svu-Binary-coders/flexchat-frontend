/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import {
  Plus,
  Users,
  MessageSquare,
  Archive,
  Lock,
  ChevronRight,
  Settings,
  Pin,
  Star,
  Inbox,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { Contact } from "@/types/chat";
import ContactItem from "./ContactItem";
import SearchBar from "./SearchBar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useContacts } from "@/hooks/useContacts";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { getNameFallback } from "@/utils/getNameFallback";
import { toast } from "sonner";
import api from "@/lib/axios";
import { initGroupSenderKey } from "@/helper/groupE2EHelper";
import CreateGroupModal from "./CreateGroupModal";
const TABS = [
  { key: "all", label: "All", icon: Inbox },
  { key: "unread", label: "Unread", icon: MessageSquare },
  { key: "Pinned", label: "Pinned", icon: Pin },
  { key: "Favorites", label: "Favorites", icon: Star },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Sidebar() {
  const { myId } = useAuthStore();
  const { visibleContacts, activeContact, openChat, setShowNewChat } =
    useChatStore();
  const contacts = visibleContacts();
  const { data: authData } = useAuth();
  const { isLoading: contactsLoading } = useContacts(myId);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const router = useRouter();

  const [openGroupModal, setOpenGroupModal] = useState(false);

  /*  Counts  */
  const unreadTotal = contacts.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
  const pinnedTotal = contacts.filter((c) => c.isPinned).length;
  const favoritesTotal = contacts.filter((c) => c.isFavorite).length;

  // group chat create
  const handleCreateGroup = async (groupData: any) => {
    const { name, description, participantIds, groupSettings } = groupData;

    if (!name) {
      toast.warning("Group name is required");
      return;
    }
    if (participantIds.length < 2) {
      toast.warning("At least 2 participants are required not including you");
      return;
    }

    // 1. Call API to create group
    const { data } = await api.post("/group/create", {
      groupName: name,
      groupDescription: description,
      participantIds: participantIds,
      groupSettings: groupSettings,
    });

    if (!data.success) {
      toast.error("Failed to create group chat");
      return;
    }

    // 2. Extract data
    const { chat, friendsPublicKeys } = data.newGroupChat;

    try {
      await initGroupSenderKey(chat.customChatId, myId, friendsPublicKeys);

      const newChatContact: Contact = {
        id: chat.id,
        name: chat.groupName,
        customChatId: chat.customChatId,
        isGroupChat: chat.isGroupChat,
        lastMessage: chat.lastMessage,
        unreadCount: 0,
        participants: chat.participants.map(
          (p: any): Contact => ({
            id: p.id,
            name: p.userName,
            profile_image: p.profilePicture,
          }),
        ),
      };
      useChatStore.setState((state) => ({
        contacts: [newChatContact, ...state.contacts],
      }));
      openChat(newChatContact);
      setOpenGroupModal(false);

      toast.success("Group created successfully!");
    } catch (error) {
      console.error("Failed to setup group security:", error);
      toast.error("Group created, but security setup failed.");
    }
  };

  const getBadge = (key: TabKey) => {
    if (key === "unread") return unreadTotal || null;
    if (key === "Pinned") return pinnedTotal || null;
    if (key === "Favorites") return favoritesTotal || null;
    return null;
  };

  /*  Filtering  */
  const filtered = contacts.filter((c) => {
    const matchName = c.name.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      tab === "all"
        ? true
        : tab === "unread"
          ? (c.unreadCount ?? 0) > 0
          : tab === "Pinned"
            ? !!c.isPinned
            : tab === "Favorites"
              ? !!c.isFavorite
              : false;
    return matchName && matchTab;
  });

  return (
    <aside
      className="
      flex flex-col w-full h-full min-h-0 overflow-hidden
      bg-white dark:bg-[#0d1117]
      border-r border-slate-100 dark:border-white/6 max-w-[480px]
    "
    >
      {/*  Top Profile Bar  */}
      <div
        className="
        flex items-center gap-3 px-4 py-3
        border-b border-slate-100 dark:border-white/6
        bg-white/80 dark:bg-[#0d1117]/90
        backdrop-blur-sm
      "
      >
        {/* Avatar with online ring */}
        <div className="relative shrink-0">
          <Avatar className="w-9 h-9 ring-2 ring-emerald-400/40 ring-offset-1 ring-offset-white dark:ring-offset-[#0d1117]">
            <AvatarImage src={authData?.profile_image} alt="Profile" />
            <AvatarFallback className="bg-gradient-to-br from-sky-400 to-indigo-500 text-white text-xs font-bold">
              {/* show first name + last name first letters */}
              {getNameFallback(authData?.name)}
            </AvatarFallback>
          </Avatar>
          {/* Pulse dot */}
          <span
            className="
            absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full
            bg-emerald-400 ring-2 ring-white dark:ring-[#0d1117]
          "
          >
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
          </span>
        </div>

        {/* Name + ID */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
            {authData?.name ?? "You"}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono mt-0.5">
            {authData?.user_id}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            onClick={() => router.push("?page=settings&subPage=profile")}
            size="icon"
            className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/8 transition-colors"
          >
            <Settings className="h-3.75 w-3.75" />
          </Button>
        </div>
      </div>

      {/*  Search  */}
      <div className="px-4 pt-3 pb-2">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/*  Tabs  */}
      <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
        {TABS.map(({ key, label, icon: Icon }) => {
          const badge = getBadge(key);
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
                "whitespace-nowrap transition-all duration-200 select-none",
                isActive
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/25"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/8",
              )}
            >
              <Icon
                className={cn(
                  "h-3 w-3 shrink-0",
                  isActive ? "opacity-100" : "opacity-60",
                )}
              />
              {label}
              {badge !== null && (
                <span
                  className={cn(
                    "min-w-5  h-5 px-2 rounded-full text-[7px] font-bold flex items-center justify-center leading-none",
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400",
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* Utility shortcuts — only on mobile, all tab, no search */}
        {!search && tab === "all" && (
          <div className="md:hidden mb-1">
            {[
              {
                icon: Archive,
                color: "amber",
                label: "Archived",
                sub: "Tap to see archived chats",
              },
              {
                icon: Lock,
                color: "sky",
                label: "Locked Chats",
                sub: "Use fingerprint or PIN to unlock",
              },
            ].map(({ icon: Icon, color, label, sub }) => (
              <button
                key={label}
                className="
                  w-full flex items-center gap-3 px-4 py-3
                  hover:bg-slate-50 dark:hover:bg-white/3
                  active:bg-slate-100 dark:active:bg-white/5
                  transition-colors border-b border-slate-50 dark:border-white/4
                "
              >
                <div
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                    color === "amber"
                      ? "bg-amber-50 dark:bg-amber-500/10"
                      : "bg-sky-50 dark:bg-sky-500/10",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      color === "amber" ? "text-amber-500" : "text-sky-500",
                    )}
                  />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {label}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {sub}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Section label */}
        {!search && (
          <div className="flex items-center justify-between px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600">
              {tab === "all" ? "Recent" : tab}
            </p>
            <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium">
              {filtered.length} chats
            </span>
          </div>
        )}

        {/* Loading skeleton */}
        {contactsLoading ? (
          <div className="flex flex-col gap-0.5 px-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-2 py-3 animate-pulse"
              >
                <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-28 bg-slate-100 dark:bg-white/5 rounded-full" />
                  <div className="h-2 w-40 bg-slate-100 dark:bg-white/3 rounded-full" />
                </div>
                <div className="h-2 w-8 bg-slate-100 dark:bg-white/3 rounded-full" />
              </div>
            ))}
          </div>
        ) : /* Empty state */
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
            <div
              className="
              w-16 h-16 rounded-2xl
              bg-slate-50 dark:bg-white/4
              border border-slate-100 dark:border-white/6
              flex items-center justify-center
            "
            >
              <MessageSquare className="h-6 w-6 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                {search ? "No results found" : "No conversations yet"}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-600">
                {search
                  ? `Nothing matched "${search}"`
                  : "Start a new conversation below"}
              </p>
            </div>
          </div>
        ) : (
          /* Contact list */
          <div className="pb-4">
            {filtered.map((contact: Contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                isActive={activeContact?.id === contact.id}
                onClick={() => openChat(contact)}
              />
            ))}
          </div>
        )}
      </div>

      {/*  Bottom CTA  */}
      <div
        className="
        px-4 py-3 space-y-2
        border-t border-slate-100 dark:border-white/6
        bg-white/60 dark:bg-[#0d1117]/80 backdrop-blur-sm
      "
      >
        <Button
          onClick={() => setShowNewChat(true)}
          className="
            w-full h-9 rounded-xl text-sm font-semibold gap-2
            bg-sky-500 hover:bg-sky-600 text-white
            shadow-sm shadow-sky-500/20
            transition-all duration-200 active:scale-[0.98]
          "
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>

        <Button
          variant="ghost"
          className="
            w-full h-9 rounded-xl text-sm font-medium gap-2
            text-slate-500 dark:text-slate-400
            hover:text-slate-700 dark:hover:text-slate-200
            hover:bg-slate-100 dark:hover:bg-white/5
            transition-all duration-200
          "
          onClick={() => setOpenGroupModal(true)}
        >
          <Users className="h-4 w-4" />
          Create Group
        </Button>
      </div>
      {openGroupModal && (
        <CreateGroupModal
          isOpen={openGroupModal}
          onClose={() => setOpenGroupModal(false)}
          myId={myId}
          onCreateGroup={handleCreateGroup}
        />
      )}
    </aside>
  );
}
