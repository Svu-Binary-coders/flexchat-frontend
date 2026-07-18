"use client";

import { useState, useEffect } from "react";
import { MessageSquareDashed } from "lucide-react";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import InputBar from "../input/InputBar";
import ProfilePanel from "@/components/profile/userProfile";
import { useChatStore } from "@/stores/chatStore";
import { useChatSettings } from "@/stores/chatSettingsStore";
import { toast } from "sonner";
import GroupDetailsSidebar from "../groupDetalisSidebar";
import { useAuthStore } from "@/stores/authStore";

export default function ChatWindow() {
  const { activeContact } = useChatStore();
  const [showProfile, setShowProfile] = useState(false);
  const myId = useAuthStore((state) => state.myId);
  const chatId = activeContact?.customChatId ?? activeContact?.id ?? ""; 
  const chatSettings = useChatSettings(chatId);
  const isProtected = !!chatSettings?.isScreenShotBlur;

  useEffect(() => {
    if (!isProtected) return;

    const onKey = (e: KeyboardEvent) => {
      const isScreenshot =
        e.key === "PrintScreen" ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") || // Windows Snip
        (e.metaKey && e.shiftKey && e.key === "4"); // Mac

      if (isScreenshot) {
        toast.warning("Screenshot attempt detected");
      }
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [isProtected]);

  // Copy Block
  const handleCopy = (e: React.ClipboardEvent) => {
    if (isProtected && !chatSettings?.isCopyEnabled) {
      e.preventDefault();
      toast.error("Copy blocked");
    }
  };

  // Right-click Block
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isProtected && !chatSettings?.isCopyEnabled) {
      e.preventDefault();
    }
  };

  // If no conversation is selected
  if (!activeContact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
        <div className="h-20 w-20 rounded-3xl bg-white dark:bg-slate-900 border shadow-sm flex items-center justify-center">
          <MessageSquareDashed className="h-9 w-9 text-slate-300" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-500">
            No conversation selected
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Choose a contact to start chatting
          </p>
        </div>
      </div>
    );
  }

  // ================================
  //  MAIN UI (Without Blur)
  // ================================
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <ChatHeader onProfileClick={() => setShowProfile(true)} />

      {/*  REPEATING WATERMARK (Always Visible) */}
      {isProtected && activeContact?.name && (
        <div
          className="absolute inset-0 pointer-events-none z-[45] select-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='220' height='150' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='rgba(148, 163, 184, 0.08)' font-size='22' font-family='sans-serif' font-weight='bold' transform='rotate(-30, 110, 75)'%3E${encodeURIComponent(
              activeContact.name,
            )}%3C/text%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
          }}
        />
      )}

      {/* CHAT LIST AREA */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onCopy={handleCopy}
        onContextMenu={handleContextMenu}
      >
        <MessageList />
      </div>

      <InputBar />

      {/* PROFILE OVERLAY */}
      {showProfile && (
        <div
          className="absolute inset-0 z-10"
          onClick={() => setShowProfile(false)}
        />
      )}

      {showProfile &&
        (activeContact.isGroupChat ? (
          <GroupDetailsSidebar
            chatId={activeContact.id}
            customChatId={activeContact.customChatId || activeContact.id}
            myId={myId}
            open={showProfile}
            onClose={() => setShowProfile(false)}
          />
        ) : (
          <ProfilePanel
            userId={activeContact.id}
            open={showProfile}
            onClose={() => setShowProfile(false)}
          />
        ))}
    </div>
  );
}
