"use client";
import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  UserPlus,
  UserMinus,
  Crown,
  Image as ImageIcon,
  FileText,
  Edit3,
  Camera,
  Bell,
  BellOff,
  LogOut,
  Trash2,
  ChevronDown,
  Loader2,
  Lock,
  Globe,
  Phone,
  Video,
  Share2,
  ArrowLeft,
  Play,
  Flag,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MediaViewer } from "@/components/chat/media/MediaViewer";
import api from "@/lib/axios";
import { toast } from "sonner";
import Image from "next/image";
import { Contact } from "@/types/chat";
import { useChatStore } from "@/stores/chatStore";

//  Types
interface Participant {
  _id: string;
  userName: string;
  email?: string;
  profilePicture?: string;
  customId: string;
  isAdmin: boolean;
}

interface GroupAttachment {
  url: string;
  type: "image" | "video" | "file" | "audio" | "VoiceMessage";
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  uploadedBy: { userName: string; profilePicture: string };
}

interface GroupDetails {
  customChatId: string;
  groupName: string;
  groupDescription?: string;
  groupAvatarUrl?: string;
  totalParticipants: number;
  participants: Participant[];
  groupSettings?: {
    onlyAdminsCanMessage?: boolean;
    onlyAdminsCanAddMembers?: boolean;
  };
}

interface GroupDetailsSidebarProps {
  chatId: string;
  customChatId: string;
  myId: string;
  open: boolean;
  onClose: () => void;
}

//  Helpers
const formatBytes = (bytes: number) => {
  if (!+bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

//  Sub-components
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

function DangerRow({
  icon,
  label,
  last = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  last?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
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

function ParticipantRow({
  participant,
  isMe,
  canManage,
  onRemove,
  onToggleAdmin,
}: {
  participant: Participant;
  isMe: boolean;
  canManage: boolean;
  onRemove: (id: string) => void;
  onToggleAdmin: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-100 dark:border-slate-800/50 last:border-0">
      <div className="relative shrink-0">
        <Avatar className="w-10 h-10">
          <AvatarImage src={participant.profilePicture} />
          <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
            {participant.userName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {participant.isAdmin && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
            <Crown className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[14px] font-medium text-slate-800 dark:text-slate-200 truncate">
            {participant.userName}
            {isMe && <span className="text-slate-400 font-normal"> (You)</span>}
          </span>
          {participant.isAdmin && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
          @{participant.customId}
        </p>
      </div>
      {canManage && !isMe && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 animate-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    onToggleAdmin(participant._id);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <Crown className="w-4 h-4 text-amber-500" />
                  {participant.isAdmin ? "Remove as admin" : "Make group admin"}
                </button>
                <button
                  onClick={() => {
                    onRemove(participant._id);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <UserMinus className="w-4 h-4" />
                  Remove from group
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

//  Main Component
export default function GroupDetailsSidebar({
  chatId,
  customChatId,
  myId,
  open,
  onClose,
}: GroupDetailsSidebarProps) {
  const qc = useQueryClient();
  const [currentView, setCurrentView] = useState<"main" | "media">("main");
  const [mediaTab, setMediaTab] = useState<"image" | "video" | "file">("image");
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [muted, setMuted] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [avatarMenu, setAvatarMenu] = useState(false);

  const [viewerData, setViewerData] = useState<{
    items: { url: string; type: "image" | "video"; name?: string }[];
    initialIndex: number;
  } | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setCurrentView("main");
        setShowAllMembers(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const { data: details, isLoading } = useQuery<GroupDetails>({
    queryKey: ["group-details", chatId],
    queryFn: async () => {
      const { data } = await api.get(`/group/${chatId}/chat-details`);
      if (!data.success) throw new Error("Failed");
      const d = data.chatDetails;
      return {
        customChatId: d.customChatId,
        groupName: d.groupName,
        groupDescription: d.groupDescription,
        groupAvatarUrl: d.groupAvatarUrl ?? d.groupAvatar,
        totalParticipants: d.totalParticipants,
        participants: d.participants,
        groupSettings: {
          onlyAdminsCanMessage: d.groupSettings?.isAdminOnlyMessaging ?? false,
          onlyAdminsCanAddMembers:
            d.groupSettings?.isAdminInvitationsAllowed ?? false,
        },
      };
    },
    enabled: open && !!chatId,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const { data: attachments = [], isLoading: loadingMedia } = useQuery<
    GroupAttachment[]
  >({
    queryKey: ["group-attachments", customChatId],
    queryFn: async () => {
      const { data } = await api.get(`/chats/${customChatId}/attachments`);
      if (!data.success) throw new Error("Failed");
      return data.attachments ?? [];
    },
    enabled: open && !!customChatId,
    staleTime: 1000 * 60 * 2,
  });

  const handleOpenMedia = () => {
    setCurrentView("media");
  };

  const handleRemove = async (userId: string) => {
    try {
      await api.delete(`/group/${chatId}/remove-participants`, {
        data: { participantIds: [userId] },
      });
      qc.setQueryData<GroupDetails>(["group-details", chatId], (old) =>
        old
          ? {
              ...old,
              participants: old.participants.filter((p) => p._id !== userId),
              totalParticipants: old.totalParticipants - 1,
            }
          : old,
      );
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const handleToggleAdmin = async (userId: string) => {
    try {
      await api.post(`/group/${chatId}/toggle-admin`, { userId });
      //  cache update
      qc.setQueryData<GroupDetails>(["group-details", chatId], (old) =>
        old
          ? {
              ...old,
              participants: old.participants.map((p) =>
                p._id === userId ? { ...p, isAdmin: !p.isAdmin } : p,
              ),
            }
          : old,
      );
    } catch {
      toast.error("Failed to update admin");
    }
  };

  const loadAllParticipants = async () => {
    if (loadingMembers) return;
    setLoadingMembers(true);
    try {
      const { data } = await api.get(`/group/${chatId}/participants`);
      if (data.success) {
        setAllParticipants(data.data.participants);
        setShowAllMembers(true);
      }
    } catch {
      toast.error("Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const isAdmin = details?.participants.some(
    (p) => p._id === myId && p.isAdmin,
  );
  const displayedParticipants = showAllMembers
    ? allParticipants
    : (details?.participants ?? []);

  const images = useMemo(
    () => attachments.filter((a) => a.type === "image"),
    [attachments],
  );
  const videos = useMemo(
    () => attachments.filter((a) => a.type === "video"),
    [attachments],
  );
  const files = useMemo(
    () =>
      attachments.filter(
        (a) =>
          a.type === "file" || a.type === "audio" || a.type === "VoiceMessage",
      ),
    [attachments],
  );
  const activeMediaData =
    mediaTab === "image" ? images : mediaTab === "video" ? videos : files;
  const previewAttachments = attachments
    .filter((a) => a.type === "image" || a.type === "video")
    .slice(0, 5);

  // upload group chat image
  const handleUploadGroupChatImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should be less than 5MB");
      return;
    }
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("groupChatImage", file);
      const { data } = await api.post(
        `/uploads/group-chat-image/${chatId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      if (data.success) {
        const newAvatarUrl = data.url;

        // group details cache update
        qc.setQueryData<GroupDetails>(
          ["group-details", chatId],
          (old) => (old ? { ...old, groupAvatarUrl: newAvatarUrl } : old),
        );

        // contacts list cache update
        useChatStore.setState((s) => ({
          contacts: s.contacts.map((c) =>
            c.customChatId === customChatId
              ? { ...c, avatar: newAvatarUrl }
              : c,
          ),
        }));

        toast.success("Group image updated");
      }
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveGroupChatImage = async () => {
    try {
      setUploadingImage(true);
      const { data } = await api.delete(`/uploads/group-chat-image/${chatId}`, {
        data: { chatId },
      });
      if (data.success) {
        qc.setQueryData<GroupDetails>(["group-details", chatId], (old) =>
          old ? { ...old, groupAvatarUrl: undefined } : old,
        );
        useChatStore.setState((s) => ({
          contacts: s.contacts.map((c) =>
            c._id === chatId ? { ...c, avatar: undefined } : c,
          ),
        }));
        toast.success("Group image removed");
      }
    } catch (error) {
      toast.error("Failed to remove image");
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div
      className={cn(
        "absolute top-0 right-0 h-full w-full md:w-[340px] lg:w-[400px] z-20",
        "bg-slate-50 dark:bg-slate-950",
        "border-l border-slate-200 dark:border-slate-800",
        "flex flex-col overflow-hidden",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      {currentView === "media" ? (
        //  MEDIA VIEW
        <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-in slide-in-from-right-8 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-900 shadow-sm shrink-0 border-b dark:border-slate-800">
            <button
              onClick={() => setCurrentView("main")}
              className="hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
            <span className="text-[16px] font-semibold text-slate-800 dark:text-slate-200">
              Group Media
            </span>
          </div>

          <div className="flex items-center px-4 py-2 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full">
              {[
                {
                  id: "image",
                  label: "Photos",
                  icon: ImageIcon,
                  count: images.length,
                },
                {
                  id: "video",
                  label: "Videos",
                  icon: Play,
                  count: videos.length,
                },
                {
                  id: "file",
                  label: "Docs",
                  icon: FileText,
                  count: files.length,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() =>
                    setMediaTab(tab.id as "image" | "video" | "file")
                  }
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium rounded-md transition-all",
                    mediaTab === tab.id
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full ml-0.5">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loadingMedia ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : activeMediaData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                <FileText className="w-12 h-12 mb-3" />
                <p className="text-sm">
                  No {mediaTab === "file" ? "documents" : mediaTab + "s"} shared
                  yet
                </p>
              </div>
            ) : mediaTab === "file" ? (
              <div className="flex flex-col gap-2">
                {files.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Image
                          src={
                            doc.uploadedBy.profilePicture ||
                            "/default-profile.png"
                          }
                          alt=""
                          className="w-3.5 h-3.5 rounded-full"
                          width={14}
                          height={14}
                          loading="lazy"
                        />
                        <p className="text-xs text-slate-400">
                          {doc.uploadedBy.userName} · {formatBytes(doc.size)}
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {activeMediaData.map((item, i) => (
                  <div
                    key={i}
                    onClick={() =>
                      setViewerData({
                        items: activeMediaData.map((m) => ({
                          url: m.url,
                          type: m.type as "image" | "video",
                          name: m.name,
                        })),
                        initialIndex: i,
                      })
                    }
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer relative group bg-slate-200 dark:bg-slate-800"
                  >
                    {item.type === "image" ? (
                      <Image
                        src={item.url || "/default.png"}
                        alt={item.name || "attachment"}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        width={100}
                        height={100}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white/80" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full animate-in slide-in-from-left-8 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-600 dark:bg-slate-900 text-white shrink-0 border-b dark:border-slate-800">
            <button
              onClick={onClose}
              className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-[17px] font-semibold tracking-wide">
              Group Info
            </span>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : !details ? null : (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Avatar */}
              <div className="flex flex-col items-center py-8 bg-gradient-to-b from-emerald-500 to-emerald-600 dark:from-slate-800 dark:to-slate-900">
                <div className="relative">
                  <div className="relative">
                    <Avatar className="w-24 h-24 border-4 border-white dark:border-slate-800 shadow-md">
                      <AvatarImage src={details.groupAvatarUrl} />
                      <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-3xl font-bold">
                        {details.groupName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {uploadingImage && (
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <>
                      <input
                        id="groupChatImageInput"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleUploadGroupChatImage}
                      />

                      {/* camera button */}
                      <button
                        onClick={() => setAvatarMenu((v) => !v)}
                        disabled={uploadingImage}
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </button>

                      {avatarMenu && (
                        <>
                          {/* backdrop */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setAvatarMenu(false)}
                          />

                          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-20 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                            {/* Upload */}
                            <button
                              onClick={() => {
                                setAvatarMenu(false);
                                document
                                  .getElementById("groupChatImageInput")
                                  ?.click();
                              }}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <Camera className="w-4 h-4 text-emerald-500" />
                              Upload photo
                            </button>

                            {details.groupAvatarUrl && (
                              <button
                                onClick={() => {
                                  setAvatarMenu(false);
                                  handleRemoveGroupChatImage();
                                }}
                                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove photo
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <h2 className="text-[20px] font-semibold text-white">
                    {details.groupName}
                  </h2>
                  {isAdmin && (
                    <button className="p-1 rounded-full hover:bg-white/20 transition-colors">
                      <Edit3 className="w-3.5 h-3.5 text-white/80" />
                    </button>
                  )}
                </div>
                <p className="text-emerald-100 dark:text-slate-400 text-[13px] mt-1">
                  Group · {details.totalParticipants} members
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex justify-center gap-2 px-4 py-5 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-100 dark:border-slate-800">
                {[
                  { icon: Phone, label: "Audio" },
                  { icon: Video, label: "Video" },
                  {
                    icon: muted ? BellOff : Bell,
                    label: muted ? "Unmute" : "Mute",
                    action: () => setMuted(!muted),
                  },
                  { icon: Share2, label: "Share" },
                ].map(({ icon: Icon, label, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="flex flex-col items-center gap-2 flex-1 group"
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 transform group-hover:scale-105",
                        label === "Mute" || label === "Unmute"
                          ? "bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                          : "bg-emerald-50 dark:bg-emerald-500/10 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-5 h-5",
                          label === "Mute" || label === "Unmute"
                            ? "text-slate-600 dark:text-slate-400"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                      />
                    </div>
                    <span className="text-[12px] text-slate-600 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-medium transition-colors">
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Description */}
              {details.groupDescription && (
                <PanelSection>
                  <div className="px-5 py-4">
                    <p className="text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold mb-1.5 uppercase tracking-wider">
                      Description
                    </p>
                    <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      {details.groupDescription}
                    </p>
                  </div>
                </PanelSection>
              )}

              {/* Media Preview */}
              <PanelSection>
                <div className="px-5 py-4">
                  <button
                    onClick={handleOpenMedia}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-lg transition-colors mb-3 group"
                  >
                    <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                      Shared Media{" "}
                      {attachments.length > 0 && `(${attachments.length})`}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] text-slate-500 font-medium">
                        See All
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </button>

                  {loadingMedia ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                    </div>
                  ) : previewAttachments.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {previewAttachments.map((item, i) => (
                        <div
                          key={i}
                          onClick={handleOpenMedia}
                          className="aspect-square rounded-lg overflow-hidden cursor-pointer relative group/thumb bg-slate-200 dark:bg-slate-800 hover:opacity-90 transition-opacity"
                        >
                          {item.type === "image" ? (
                            <Image
                              src={item.url || "/default.png"}
                              alt={item.name || "attachment"}
                              className="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-105"
                              width={100}
                              height={100}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                              <Play className="w-4 h-4 text-white/80" />
                            </div>
                          )}
                          {i === 3 &&
                            attachments.filter(
                              (a) => a.type === "image" || a.type === "video",
                            ).length > 4 && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white text-sm font-bold">
                                  +
                                  {attachments.filter(
                                    (a) =>
                                      a.type === "image" || a.type === "video",
                                  ).length - 4}
                                </span>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">
                      No media shared yet
                    </p>
                  )}
                </div>
              </PanelSection>

              {/* Group Settings */}
              {isAdmin && details.groupSettings && (
                <PanelSection>
                  <div className="px-5 py-4">
                    <p className="text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold mb-3 uppercase tracking-wider">
                      Group Settings
                    </p>
                    <div className="flex flex-col gap-4">
                      {[
                        {
                          icon: Lock,
                          label: "Only admins can message",
                          key: "onlyAdminsCanMessage" as const,
                        },
                        {
                          icon: Globe,
                          label: "Only admins can add members",
                          key: "onlyAdminsCanAddMembers" as const,
                        },
                      ].map(({ icon: Icon, label, key }) => (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {label}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "w-10 h-[22px] rounded-full relative cursor-pointer transition-colors",
                              details.groupSettings![key]
                                ? "bg-emerald-500"
                                : "bg-slate-200 dark:bg-slate-700",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform",
                                details.groupSettings![key]
                                  ? "translate-x-[22px]"
                                  : "translate-x-[3px]",
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </PanelSection>
              )}

              {/* Participants */}
              <PanelSection>
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                    {details.totalParticipants} Members
                  </p>
                  {isAdmin && (
                    <button className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-700 transition-colors">
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </button>
                  )}
                </div>
                {displayedParticipants.map((p) => (
                  <ParticipantRow
                    key={p._id}
                    participant={p}
                    isMe={p._id === myId}
                    canManage={!!isAdmin}
                    onRemove={handleRemove}
                    onToggleAdmin={handleToggleAdmin}
                  />
                ))}
                {!showAllMembers && details.totalParticipants > 10 && (
                  <button
                    onClick={loadAllParticipants}
                    disabled={loadingMembers}
                    className="flex items-center gap-2 w-full px-5 py-3.5 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors"
                  >
                    {loadingMembers ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    See all {details.totalParticipants} members
                  </button>
                )}
                {showAllMembers && (
                  <button
                    onClick={() => setShowAllMembers(false)}
                    className="flex items-center gap-2 w-full px-5 py-3.5 text-sm text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 rotate-180" /> Show less
                  </button>
                )}
              </PanelSection>

              {/* Danger Zone */}
              <PanelSection className="mb-8">
                <DangerRow
                  icon={<LogOut className="w-4 h-4" />}
                  label="Leave group"
                />
                <DangerRow
                  icon={<Flag className="w-4 h-4" />}
                  label="Report group"
                />
                {isAdmin && (
                  <DangerRow
                    icon={<Trash2 className="w-4 h-4" />}
                    label="Delete group"
                    last
                  />
                )}
              </PanelSection>
            </div>
          )}
        </div>
      )}

      {viewerData &&
        typeof document !== "undefined" &&
        createPortal(
          <MediaViewer
            items={viewerData.items}
            initialIndex={viewerData.initialIndex}
            onClose={() => setViewerData(null)}
          />,
          document.body,
        )}
    </div>
  );
}
