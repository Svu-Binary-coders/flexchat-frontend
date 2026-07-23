"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  MessageCircle,
  Phone,
  Video,
  Share2,
  MapPin,
  AtSign,
  Globe,
  Ban,
  Flag,
  Loader2,
  Calendar,
  Mail,
  Star,
  Pin,
  ArrowLeft,
  ChevronRight,
  Play,
  FileText,
  ImageIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import api from "@/lib/axios";
import { API_URL, fmtTime } from "@/lib/chat-helpers";
import { useChatStore } from "@/stores/chatStore";
import { ActionTooltip } from "../reuse/ActionTooltip";
import Image from "next/image";

import { MediaViewer } from "@/components/chat/media/MediaViewer";
import {
  useChatSettings,
  useChatSettingsStore,
} from "@/stores/chatSettingsStore";

// --- Types ---
interface UserProfile {
  id: string;
  name: string;
  email: string;
  user_id: string;
  profile_image?: string;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: string;
  location?: { city: string; country: string };
  website?: string;
  create_at?: string;
}

interface SharedMedia {
  _id: string;
  uploadedBy: {
    userName: string;
    profilePicture?: string;
  };
  url: string;
  type: "image" | "video" | "raw" | "file" | "audio" | "other";
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

interface Props {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}

// --- Helper Functions ---
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// --- API Calls ---
const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  const res = await api.get(`${API_URL}/chats/viewDetails/${userId}`);
  return res.data.user;
};

const fetchSharedMedia = async (chatId: string): Promise<SharedMedia[]> => {
  const { data } = await api.get(`/chats/${chatId}/attachments`);
  return data.attachments || [];
};

export default function ProfilePanel({ userId, open, onClose }: Props) {
  const [currentView, setCurrentView] = useState<"main" | "media">("main");
  const [mediaTab, setMediaTab] = useState<"image" | "video" | "raw">("image");

  const [viewerData, setViewerData] = useState<{
    items: { url: string; type: "image" | "video"; name?: string }[];
    initialIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setCurrentView("main");
        setMediaTab("image");
      }, 300);
    }
  }, [open]);

  const { togglePin, toggleFavorite, contacts, openChat } = useChatStore();

  const contactStoreData = useMemo(() => {
    return contacts.find((c) => c.id === userId);
  }, [contacts, userId]);

  const isPinned = contactStoreData?.isPinned || false;
  const isFavorite = contactStoreData?.isFavorite || false;
  const customChatId = contactStoreData?.customChatId;
  const chatSettings = useChatSettings(customChatId);
  const updateSettings = useChatSettingsStore((s) => s.updateSettings);
  // User Profile Query
  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId && open,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  // Shared Media Query
  const { data: mediaItems = [], isLoading: isMediaLoading } = useQuery({
    queryKey: ["sharedMedia", customChatId],
    queryFn: () => fetchSharedMedia(customChatId!),
    enabled: !!customChatId && open,
    staleTime: 1000 * 60 * 5,
  });

  // Filter media based on type
  const images = useMemo(
    () => mediaItems.filter((m) => m.type === "image"),
    [mediaItems],
  );
  const videos = useMemo(
    () => mediaItems.filter((m) => m.type === "video"),
    [mediaItems],
  );
  const docs = useMemo(
    () =>
      mediaItems.filter(
        (m) =>
          m.type === "raw" ||
          m.type === "file" ||
          m.type === "audio" ||
          m.type === "other" ||
          (!m.mimeType.startsWith("image/") &&
            !m.mimeType.startsWith("video/")),
      ),
    [mediaItems],
  );

  // Get active tab data
  const activeMediaData =
    mediaTab === "image" ? images : mediaTab === "video" ? videos : docs;

  return (
    <div
      className={`absolute top-0 right-0 h-full w-full md:w-[340px] lg:w-[400px] z-20
                   bg-slate-50 dark:bg-slate-950
                   border-l border-slate-200 dark:border-slate-800
                   flex flex-col overflow-hidden
                   transition-transform duration-300 ease-in-out
                   ${open ? "translate-x-0" : "translate-x-full"}`}
    >
      {currentView === "media" ? (
        // --- MEDIA VIEW ---
        <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-in slide-in-from-right-8 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-900 shadow-sm shrink-0 border-b dark:border-slate-800">
            <ActionTooltip text="Back to Profile" side="left">
              <button
                onClick={() => setCurrentView("main")}
                className="hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors outline-none"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>
            </ActionTooltip>
            <span className="text-[16px] font-semibold text-slate-800 dark:text-slate-200">
              Shared Media
            </span>
          </div>

          {/* Media Tabs */}
          <div className="flex items-center px-4 py-2 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full">
              {[
                {
                  id: "image",
                  label: "Images",
                  icon: ImageIcon,
                  count: images.length,
                },
                {
                  id: "video",
                  label: "Videos",
                  icon: Video,
                  count: videos.length,
                },
                {
                  id: "raw",
                  label: "Docs",
                  icon: FileText,
                  count: docs.length,
                },
              ].map((tab) => {
                const isActive = mediaTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() =>
                      setMediaTab(tab.id as "image" | "video" | "raw")
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium rounded-md transition-all outline-none
                      ${
                        isActive
                          ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                      }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full ml-1">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media Content Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {isMediaLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : activeMediaData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                {mediaTab === "image" && (
                  <ImageIcon className="w-12 h-12 mb-3" />
                )}
                {mediaTab === "video" && <Video className="w-12 h-12 mb-3" />}
                {mediaTab === "raw" && <FileText className="w-12 h-12 mb-3" />}
                <p className="text-sm">
                  No {mediaTab === "raw" ? "document" : mediaTab}s shared yet
                </p>
              </div>
            ) : mediaTab === "raw" ? (
              <div className="flex flex-col gap-2">
                {activeMediaData.map((doc, index) => (
                  <div
                    key={index}
                    onClick={() => window.open(doc.url, "_blank")}
                    className="flex items-center gap-3 p-3 rounded-lg border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                          {doc.mimeType.split("/").pop()}
                        </p>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatBytes(doc.size)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {activeMediaData.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      const viewerItems = activeMediaData.map((m) => ({
                        url: m.url,
                        type: m.type as "image" | "video",
                        name: m.name,
                      }));
                      setViewerData({
                        items: viewerItems,
                        initialIndex: index,
                      });
                    }}
                    className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-md cursor-pointer hover:opacity-80 transition-opacity relative group overflow-hidden"
                  >
                    {item.type === "image" ? (
                      <Image
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        height={200}
                        width={200}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <Play className="w-6 h-6 text-white opacity-80" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // --- MAIN PROFILE VIEW ---
        <div className="flex flex-col h-full animate-in slide-in-from-left-8 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 bg-blue-600 dark:bg-slate-900 text-white shrink-0 border-b dark:border-slate-800">
            <ActionTooltip text="Close" side="left">
              <button
                onClick={onClose}
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </ActionTooltip>
            <span className="text-[17px] font-semibold tracking-wide">
              Contact Info
            </span>
          </div>

          {isUserLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-500" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading profile...
              </p>
            </div>
          )}

          {isUserError && !isUserLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Could not load profile.
              </p>
              <button
                onClick={() => refetchUser()}
                className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1 hover:underline outline-none"
              >
                Try again
              </button>
            </div>
          )}

          {user && !isUserLoading && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Cover + Avatar */}
              <div className="flex flex-col items-center py-8 bg-gradient-to-b from-blue-500 to-blue-600 dark:from-slate-800 dark:to-slate-900">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-white dark:border-slate-800 shadow-md">
                    <AvatarImage src={user.profile_image} />
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-3xl font-bold">
                      {user.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {user.isOnline && (
                    <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-slate-800" />
                  )}
                </div>
                <h2 className="mt-3 text-[20px] font-semibold text-white">
                  {user.name}
                </h2>
                <p className="text-blue-100 dark:text-slate-400 text-[13px] mt-1 flex items-center gap-1.5">
                  {user.isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block shadow-[0_0_5px_rgba(74,222,128,0.5)]" />
                      Online
                    </>
                  ) : user.lastSeen ? (
                    `Last seen ${fmtTime(user.lastSeen)}`
                  ) : (
                    "Offline"
                  )}
                </p>
              </div>

              {/* Quick Action buttons */}
              <div className="flex justify-center gap-2 px-4 py-5 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-100 dark:border-slate-800">
                {[
                  { icon: MessageCircle, label: "Message" },
                  { icon: Phone, label: "Audio" },
                  { icon: Video, label: "Video" },
                  { icon: Share2, label: "Share" },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    onClick={() => {
                      if (label === "Message" && contactStoreData) {
                        openChat(contactStoreData);
                        onClose();
                      }
                    }}
                    className="flex flex-col items-center gap-2 flex-1 group outline-none"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-all duration-300 transform group-hover:scale-105">
                      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-[12px] text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-medium transition-colors">
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Bio */}
              <PanelSection>
                <div className="px-5 py-4">
                  <p className="text-[12px] text-blue-600 dark:text-blue-400 font-semibold mb-1.5 uppercase tracking-wider">
                    About
                  </p>
                  <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    {user.bio || "No bio available."}
                  </p>
                </div>
              </PanelSection>

              {/* Shared Media Section (Preview) */}
              <PanelSection>
                <div className="px-5 py-4">
                  <button
                    onClick={() => setCurrentView("media")}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-lg transition-colors mb-3 outline-none group"
                  >
                    <span className="text-[12px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
                      Shared Media ({mediaItems.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                        See All
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </button>

                  <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1">
                    {isMediaLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400 m-auto" />
                    ) : mediaItems?.length > 0 ? (
                      mediaItems?.slice(0, 5).map((item, index) => (
                        <div
                          key={index}
                          className="w-[72px] h-[72px] rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden relative"
                          onClick={() => {
                            const tabType =
                              item.type === "file" ||
                              item.type === "audio" ||
                              item.type === "other"
                                ? "raw"
                                : item.type === "video"
                                  ? "video"
                                  : "image";
                            setMediaTab(tabType as "image" | "video" | "raw");
                            setCurrentView("media");
                          }}
                        >
                          {item.type === "image" ? (
                            <Image
                              src={item.url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              height={72}
                              width={72}
                            />
                          ) : item.type === "video" ? (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                              <Play className="w-5 h-5 text-white opacity-80" />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                              <FileText className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No media shared yet
                      </p>
                    )}
                  </div>
                </div>
              </PanelSection>

              {/* Info rows */}
              <PanelSection>
                <PanelRow
                  icon={<Mail className="w-4 h-4" />}
                  label={user.email}
                  sub="Email"
                />
                <PanelRow
                  icon={<AtSign className="w-4 h-4" />}
                  label={`@${user.user_id}`}
                  sub="User ID"
                />
                {user.location && (
                  <PanelRow
                    icon={<MapPin className="w-4 h-4" />}
                    label={`${user.location.city}, ${user.location.country}`}
                    sub="Location"
                  />
                )}
                {user.website && (
                  <PanelRow
                    icon={<Globe className="w-4 h-4" />}
                    label={user.website}
                    sub="Website"
                    isLink
                  />
                )}
                {user.create_at && (
                  <PanelRow
                    icon={<Calendar className="w-4 h-4" />}
                    label={fmtTime(user.create_at)}
                    sub="Member since"
                    last
                  />
                )}
              </PanelSection>

              {/* user settings per chat view */}
              <PanelSection>
                <div className="px-5 py-4">
                  <p className="text-[12px] text-blue-600 dark:text-blue-400 font-semibold mb-1.5 uppercase tracking-wider">
                    Chat Settings
                  </p>
                </div>
                <div className="flex flex-col gap-4 px-5 pb-4">
                  {/* ১. Copy Text Permission */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                      Allow Copy Text
                    </span>
                    <input
                      type="checkbox"
                      checked={chatSettings?.isCopyEnabled ?? true}
                      onChange={(e) => {
                        if (customChatId) {
                          updateSettings(customChatId, {
                            isCopyEnabled: e.target.checked,
                          });
                        }
                      }}
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Screenshot Blur Permission */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                      Block Screenshots (Blur)
                    </span>
                    <input
                      type="checkbox"
                      checked={chatSettings?.isScreenShotBlur ?? false}
                      onChange={(e) => {
                        if (customChatId) {
                          updateSettings(customChatId, {
                            isScreenShotBlur: e.target.checked,
                          });
                        }
                      }}
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* ৩. Disappearing Timer (Dropdown) */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                      Auto Delete Messages
                    </span>
                    <select
                      value={chatSettings?.disappearingTimer || ""}
                      onChange={(e) => {
                        if (customChatId) {
                          const val = e.target.value
                            ? Number(e.target.value)
                            : null;
                          updateSettings(customChatId, {
                            disappearingTimer: val,
                          });
                        }
                      }}
                      className="text-sm p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer border border-slate-200 dark:border-slate-700"
                    >
                      <option value="">Off (Keep)</option>
                      <option value="60">1 Minute</option>
                      <option value="300">5 Minutes</option>
                      <option value="3600">1 Hour</option>
                    </select>
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Status:{" "}
                    {chatSettings?.isCopyEnabled
                      ? "Copy Enabled"
                      : "Copy Blocked"}
                  </p>
                </div>
              </PanelSection>

              {/* User Action Section */}
              <PanelSection>
                <div className="flex flex-col">
                  <button
                    onClick={() => customChatId && toggleFavorite(customChatId)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group outline-none"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20 transition-colors shrink-0">
                      <Star
                        className={`w-4 h-4 transition-colors ${isFavorite ? "text-amber-500 fill-amber-500" : "text-amber-600 dark:text-amber-400"}`}
                      />
                    </div>
                    <span className="text-[14px] font-medium text-slate-800 dark:text-slate-200">
                      {isFavorite
                        ? "Remove from Favorites"
                        : "Add to Favorites"}
                    </span>
                  </button>

                  <button
                    onClick={() => customChatId && togglePin(customChatId)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group outline-none"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors shrink-0">
                      <Pin
                        className={`w-4 h-4 transition-colors ${isPinned ? "text-slate-800 dark:text-slate-200 fill-slate-800 dark:fill-slate-200" : "text-slate-600 dark:text-slate-400"}`}
                      />
                    </div>
                    <span className="text-[14px] font-medium text-slate-800 dark:text-slate-200">
                      {isPinned ? "Unpin Conversation" : "Pin Conversation"}
                    </span>
                  </button>
                </div>
              </PanelSection>

              {/* Danger zone */}
              <PanelSection className="mb-8 border-t-0">
                <DangerRow
                  icon={<Ban className="w-4 h-4" />}
                  label={`Block @${user.user_id}`}
                />
                <DangerRow
                  icon={<Flag className="w-4 h-4" />}
                  label={`Report User`}
                  last
                />
              </PanelSection>
            </div>
          )}
        </div>
      )}

      {viewerData && typeof document !== "undefined"
        ? createPortal(
            <MediaViewer
              items={viewerData.items}
              initialIndex={viewerData.initialIndex}
              onClose={() => setViewerData(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function PanelSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white dark:bg-slate-900 mt-2 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function PanelRow({
  icon,
  label,
  sub,
  last = false,
  isLink = false,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  last?: boolean;
  isLink?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 ${!last ? "border-b border-slate-100 dark:border-slate-800/50" : ""}`}
    >
      <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className={`text-[14px] font-medium truncate ${isLink ? "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" : "text-slate-800 dark:text-slate-200"}`}
        >
          {label}
        </p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
          {sub}
        </p>
      </div>
    </div>
  );
}

function DangerRow({
  icon,
  label,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  last?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-4 px-5 py-3.5 outline-none hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors group ${!last ? "border-b border-slate-100 dark:border-slate-800/50" : ""}`}
    >
      <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-500/20 transition-colors">
        <span className="text-red-500 dark:text-red-400">{icon}</span>
      </div>
      <span className="text-[14px] font-medium text-red-600 dark:text-red-400">
        {label}
      </span>
    </button>
  );
}
