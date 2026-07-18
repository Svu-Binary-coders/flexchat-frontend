/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Message, MessageStatus } from "@/types/chat";
import { useAuthStore } from "@/stores/authStore";
import LinkPreviewCard from "./LinkPreviewCard";
import {
  Check,
  Forward,
  CheckCheck,
  Clock,
  AlertCircle,
  Ban,
  Star,
  CornerUpRight,
  ChevronDown,
  Download,
  X,
  Image as ImageIcon,
  Video,
  FileText,
  File,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  FileVideo,
  FileImage,
  Play,
  Pause,
  Mic,
  Music,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { useAppearanceStore } from "@/stores/appearanceStore";
import { timeFormatFn } from "@/lib/dateHelper";
import { MediaViewer } from "../media/MediaViewer";
import { VideoPlayer } from "../media/VideoPlayer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ReactionMap = { [emoji: string]: string[] };

function normalizeReactions(raw: any): ReactionMap {
  if (!raw) return {};
  // Already object map
  if (!Array.isArray(raw)) return raw as ReactionMap;

  const map: ReactionMap = {};

  for (const item of raw) {
    const emoji = item?.reaction || item?.emoji;

    if (emoji) {
      if (!map[emoji]) {
        map[emoji] = [];
      }

      if (item.userId && !map[emoji].includes(item.userId)) {
        map[emoji].push(item.userId);
      } else if (Array.isArray(item.userIds)) {
        item.userIds.forEach((id: string) => {
          if (!map[emoji].includes(id)) {
            map[emoji].push(id);
          }
        });
      }
    }
  }

  return map;
}

//  Reaction Details Modal
function ReactionDetailsModal({
  reactionMap,
  onClose,
}: {
  reactionMap: ReactionMap;
  onClose: () => void;
}) {
  const { contacts } = useChatStore();
  const { myId } = useAuthStore();
  console.log("reactionMap", reactionMap, contacts, myId);

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-80 max-h-[400px] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Reactions
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500 dark:text-slate-300" />
          </button>
        </div>

        {/* List of Users */}
        <div className="overflow-y-auto p-2 custom-scrollbar">
          {Object.entries(reactionMap).map(([emoji, userIds]) =>
            userIds.map((userId) => {
              const user = contacts.find((c) => c.id === userId);
              const name =
                userId === myId ? "You" : user?.name || "Unknown User";
              const avatar =
                user?.profile_image ||
                "https://cdn-icons-png.flaticon.com/512/149/149071.png";

              return (
                <div
                  key={userId + emoji}
                  className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={avatar}
                      alt={name}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
                      {name}
                    </span>
                  </div>
                  <div className="text-2xl bg-slate-100 dark:bg-slate-700 w-10 h-10 flex items-center justify-center rounded-full">
                    {emoji}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

//  Global animation styles
const bubbleAnimStyles = `
  @keyframes bubbleIn {
    from { opacity: 0; transform: translateY(8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1);    }
  }
  @keyframes voiceBar {
    0%, 100% { transform: scaleY(0.4); }
    50%       { transform: scaleY(1);   }
  }
  @keyframes reactionPop {
    0%   { transform: scale(0.5); opacity: 0; }
    70%  { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
  .bubble-enter { animation: bubbleIn 0.22s cubic-bezier(0.34,1.2,0.64,1) both; }
  .reaction-pop { animation: reactionPop 0.25s cubic-bezier(0.34,1.4,0.64,1) both; }
`;

//  helpers

const sizeLabel = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const dateLabelFn = (createdAt: string | undefined): string => {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const safeStr = (val: unknown): string => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const obj = val as any;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
  }
  return "";
};

//  Forwarded Label
function ForwardedLabel({ isMine }: { isMine: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px] mb-1.5 select-none",
        isMine ? "text-white/50" : "text-slate-400 dark:text-slate-500",
      )}
    >
      <Forward className="h-3 w-3" />
      <span>Forwarded</span>
    </div>
  );
}

//  Reaction Bar
function ReactionBar({
  reactions,
  myId,
  isMine,
  onClick,
}: {
  reactions: ReactionMap;
  myId: string;
  isMine: boolean;
  onClick: () => void;
}) {
  const entries = Object.entries(reactions).filter(
    ([, users]) => users.length > 0,
  );
  if (entries.length === 0) return null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex flex-wrap gap-1 mt-1 cursor-pointer hover:opacity-80 transition-opacity",
        isMine ? "justify-end" : "justify-start",
      )}
    >
      {entries.map(([emoji, users]) => {
        const iReacted = users.includes(myId);
        return (
          <div
            key={emoji}
            className={cn(
              "reaction-pop flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium select-none cursor-default",
              iReacted
                ? isMine
                  ? "bg-white/25 ring-1 ring-white/40 text-white"
                  : "bg-sky-100 dark:bg-sky-900/40 ring-1 ring-sky-300 dark:ring-sky-700 text-sky-700 dark:text-sky-300"
                : isMine
                  ? "bg-white/10 text-white/70"
                  : "bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400",
            )}
          >
            <span>{emoji}</span>
            {users.length > 1 && (
              <span className="text-[10px] tabular-nums">{users.length}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

//  FileIcon

export const FileIcon = ({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) => {
  const mime = mimeType?.toLowerCase() || "";
  if (mime.startsWith("image/"))
    return <FileImage className={cn("text-violet-400", className)} />;
  if (mime.startsWith("video/"))
    return <FileVideo className={cn("text-pink-400", className)} />;
  if (mime.startsWith("audio/"))
    return <Music className={cn("text-amber-400", className)} />;
  if (
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("json") ||
    mime.includes("html") ||
    mime.includes("css") ||
    mime.includes("xml") ||
    mime.includes("sql")
  )
    return <FileCode className={cn("text-emerald-400", className)} />;
  if (mime.includes("pdf"))
    return <FileText className={cn("text-rose-400", className)} />;
  if (
    mime.includes("zip") ||
    mime.includes("rar") ||
    mime.includes("tar") ||
    mime.includes("7z")
  )
    return <FileArchive className={cn("text-orange-400", className)} />;
  if (mime.includes("word") || mime.includes("document"))
    return <FileText className={cn("text-blue-400", className)} />;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
    return <FileSpreadsheet className={cn("text-teal-400", className)} />;
  if (mime.startsWith("text/"))
    return <FileText className={cn("text-slate-400", className)} />;
  return <File className={cn("text-slate-400", className)} />;
};

//  Download button
type DlState = "idle" | "downloading" | "done" | "error";

function useDownload() {
  const [state, setState] = useState<DlState>("idle");
  const [progress, setProgress] = useState(0);

  const download = useCallback(
    async (url: string, name?: string) => {
      if (state === "downloading") return;
      setState("downloading");
      setProgress(0);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Fetch failed");
        const total = Number(response.headers.get("content-length") ?? 0);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");
        const chunks: ArrayBuffer[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const copy = new Uint8Array(value.byteLength);
          copy.set(value);
          chunks.push(copy.buffer);
          received += value.byteLength;
          setProgress(total ? Math.round((received / total) * 100) : 50);
        }
        const blob = new Blob(chunks);
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        const ext = url.split("?")[0].match(/\.[a-z0-9]+$/i)?.[0] ?? "";
        link.download = name ?? `file_${Date.now()}${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        setProgress(100);
        setState("done");
        setTimeout(() => {
          setState("idle");
          setProgress(0);
        }, 2000);
      } catch {
        setState("error");
        setTimeout(() => {
          setState("idle");
          setProgress(0);
        }, 2000);
      }
    },
    [state],
  );
  return { download, state, progress };
}

function DownloadBtn({
  url,
  name,
  isMine,
}: {
  url: string;
  name?: string;
  isMine: boolean;
}) {
  const { download, state, progress } = useDownload();
  const label =
    state === "idle"
      ? "Download"
      : state === "done"
        ? "Saved!"
        : state === "error"
          ? "Failed"
          : `${progress}%`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              download(url, name);
            }}
            disabled={state === "downloading"}
            className={cn(
              "relative h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all overflow-hidden",
              isMine
                ? "bg-white/10 hover:bg-white/25 text-white/80 hover:text-white"
                : "bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300",
              state === "done" && "bg-emerald-500/20 text-emerald-400",
              state === "error" && "bg-red-500/20 text-red-400",
            )}
          >
            {state === "downloading" && (
              <svg
                className="absolute inset-0 w-8 h-8 -rotate-90"
                viewBox="0 0 32 32"
              >
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  strokeWidth="2.5"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 13}`}
                  strokeDashoffset={`${2 * Math.PI * 13 * (1 - progress / 100)}`}
                  className="transition-[stroke-dashoffset] duration-200"
                />
              </svg>
            )}
            <span className="relative">
              {state === "idle" && <Download className="h-3.5 w-3.5" />}
              {state === "downloading" && (
                <span className="text-[9px] font-bold tabular-nums">
                  {progress}%
                </span>
              )}
              {state === "done" && (
                <Check className="h-4 w-4 text-emerald-400" />
              )}
              {state === "error" && <X className="h-4 w-4 text-red-400" />}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

//  Voice Message Player

function VoicePlayer({
  url,
  name,
  size,
  isMine,
  initialDuration,
}: {
  url: string;
  name: string;
  size: number;
  isMine: boolean;
  initialDuration?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration ?? 0);
  const bars = 30;

  const [heights] = useState(() =>
    Array.from({ length: bars }, (_, i) => {
      const seed = (url.charCodeAt(i % url.length) * (i + 1)) % 100;
      return 18 + (seed % 64);
    }),
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onMeta = () => {
      if (audio.duration && isFinite(audio.duration))
        setDuration(audio.duration);
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    if (audio.readyState >= 1 && audio.duration && isFinite(audio.duration))
      setDuration(audio.duration);
    else if (initialDuration) setDuration(initialDuration);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, [url, initialDuration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const progress = duration > 0 && playing ? currentTime / duration : 0;
  const displayTime =
    duration > 0
      ? playing
        ? fmtDuration(currentTime)
        : fmtDuration(duration)
      : "…";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-3 w-[256px]",
        isMine
          ? "bg-gradient-to-br from-sky-500 to-blue-600"
          : "bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80",
      )}
    >
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={togglePlay}
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 shadow-md",
          isMine
            ? "bg-white/20 hover:bg-white/35 text-white ring-1 ring-white/20"
            : "bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-300 dark:shadow-sky-900",
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current translate-x-[1px]" />
        )}
      </button>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div
          className="flex items-center gap-[2px] h-7 cursor-pointer"
          onClick={seek}
          title="Seek"
        >
          {heights.map((h, i) => {
            const barCenter = (i + 0.5) / bars;
            const active = barCenter <= progress;
            const isPlayhead =
              Math.abs(barCenter - progress) < 1.5 / bars && playing;
            return (
              <span
                key={i}
                style={{
                  height: `${h}%`,
                  animation: isPlayhead
                    ? `voiceBar ${0.4 + (i % 4) * 0.1}s ease-in-out infinite`
                    : undefined,
                  transition: "background-color 80ms linear",
                }}
                className={cn(
                  "inline-block w-[2.5px] rounded-full flex-shrink-0",
                  isMine
                    ? active
                      ? "bg-white"
                      : "bg-white/25"
                    : active
                      ? "bg-sky-500 dark:bg-sky-400"
                      : "bg-slate-200 dark:bg-slate-600",
                )}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-[10px] font-semibold tabular-nums tracking-wide",
              isMine ? "text-white/65" : "text-slate-400 dark:text-slate-500",
            )}
          >
            {displayTime}
          </span>
          <div
            className={cn(
              "flex items-center gap-1",
              isMine ? "text-white/40" : "text-slate-300 dark:text-slate-600",
            )}
          >
            <Mic className="h-2.5 w-2.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

//  Reply Preview

type ReplyPreviewProps = {
  replyTo: Message;
  myId?: string;
  isMine: boolean;
  onClick: () => void;
};

function ReplyPreview({ replyTo, myId, isMine, onClick }: ReplyPreviewProps) {
  const atts = replyTo.attachments ?? [];

  const imgs = atts.filter((a: any) => a.type === "image");
  const vids = atts.filter((a: any) => a.type === "video");
  const voices = atts.filter((a: any) => a.type === "VoiceMessage");
  const files = atts.filter(
    (a: any) => a.type === "file" || a.type === "audio",
  );

  const replyContent = safeStr(replyTo.content);
  const hasText = !!replyContent.trim();

  // ✅ senderDetails থেকে name নাও
  const senderName =
    replyTo.senderDetails?.userName ||
    (replyTo.senderId === myId ? "You" : "Message");

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 mb-2 px-2.5 py-2 rounded-xl text-[11px] cursor-pointer hover:opacity-75 transition-opacity overflow-hidden",
        isMine
          ? "bg-white/10 border-l-2 border-white/60"
          : "bg-slate-50 dark:bg-slate-900/60 border-l-2 border-sky-400",
      )}
    >
      <CornerUpRight className="h-3 w-3 shrink-0 opacity-50" />

      {/* ✅ Image preview */}
      {imgs.length > 0 && (
        <img
          src={imgs[0].url}
          alt=""
          className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-white/20"
        />
      )}

      {/* ✅ Video preview */}
      {vids.length > 0 && imgs.length === 0 && (
        <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
          <Video className="h-4 w-4 text-white/60" />
        </div>
      )}

      {/* ✅ File preview */}
      {files.length > 0 && imgs.length === 0 && vids.length === 0 && (
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            isMine ? "bg-white/15" : "bg-slate-100 dark:bg-slate-700",
          )}
        >
          <FileIcon mimeType={files[0].mimeType} className="h-4 w-4" />
        </div>
      )}

      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={cn(
            "font-bold text-[10px] mb-0.5 uppercase tracking-wider",
            isMine ? "text-white/70" : "text-sky-500 dark:text-sky-400",
          )}
        >
          {senderName} {/* ✅ name দেখাও */}
        </span>

        <span className="truncate opacity-60 flex items-center gap-1">
          {/* content আছে */}
          {hasText && replyContent}

          {/* content নেই — type দেখাও */}
          {!hasText && imgs.length > 0 && (
            <>
              <ImageIcon className="h-3 w-3 shrink-0" /> Photo
            </>
          )}
          {!hasText && vids.length > 0 && imgs.length === 0 && (
            <>
              <Video className="h-3 w-3 shrink-0" /> Video
            </>
          )}
          {!hasText && voices.length > 0 && (
            <>
              <Mic className="h-3 w-3 shrink-0" /> Voice Message
            </>
          )}
          {!hasText &&
            files.length > 0 &&
            imgs.length === 0 &&
            vids.length === 0 && (
              <>
                <FileIcon
                  mimeType={files[0].mimeType}
                  className="h-3 w-3 shrink-0"
                />{" "}
                {files[0].name ?? "File"}
              </>
            )}
        </span>
      </div>
    </div>
  );
}
//  Status icon

const StatusIcon = ({ status }: { status: MessageStatus }) => {
  if (status === MessageStatus.SENDING)
    return <Clock className="h-3 w-3 text-white/50 animate-pulse" />;
  if (status === MessageStatus.FAILED)
    return <AlertCircle className="h-3 w-3 text-red-300" />;
  if (status === MessageStatus.SENT)
    return <Check className="h-3 w-3 text-white/50" />;
  if (status === MessageStatus.DELIVERED)
    return <CheckCheck className="h-3 w-3 text-white/60" />;
  if (status === MessageStatus.READ)
    return <CheckCheck className="h-3 w-3 text-sky-200" />;
  return null;
};

//  Image grid

const MessageImageGrid = ({
  mediaAtts,
  hasCaption,
  isMine,
  isTemp,
  progress,
  createdAt,
  timeFormat,
  status,
  isImportant,
  onOpen,
}: {
  mediaAtts: any[];
  hasCaption: boolean;
  isMine: boolean;
  isTemp: boolean;
  progress: number;
  createdAt: any;
  timeFormat: any;
  status?: MessageStatus;
  isImportant?: boolean;
  onOpen: (index: number) => void;
}) => {
  const imgs = mediaAtts.filter((a: any) => a.type === "image");
  if (imgs.length === 0) return null;

  if (imgs.length === 1) {
    const absoluteIndex = mediaAtts.findIndex(
      (a: any) => a.url === imgs[0].url,
    );
    return (
      <div
        className="relative cursor-pointer overflow-hidden group/img"
        onClick={() => onOpen(absoluteIndex >= 0 ? absoluteIndex : 0)}
      >
        <img
          src={imgs[0].url}
          alt={imgs[0].name ?? "image"}
          className={cn(
            "block w-full max-w-[288px] object-cover transition-transform duration-300 group-hover/img:scale-[1.02]",
            hasCaption
              ? "rounded-t-2xl"
              : isMine
                ? "rounded-2xl rounded-br-sm"
                : "rounded-2xl rounded-bl-sm",
            isTemp && "brightness-50",
          )}
          style={{ maxHeight: "300px" }}
        />
        {!isTemp && (
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors duration-200 rounded-inherit" />
        )}
        {isTemp && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
            <div className="w-11 h-11 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
            <div className="w-4/5 h-[3px] bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-white text-[11px] font-medium tracking-wide">
              {progress}%
            </span>
          </div>
        )}
        {!hasCaption && !isTemp && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
            {isImportant && (
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            )}
            <span className="text-[10px] text-white/90 font-medium">
              {createdAt ? timeFormatFn(createdAt, timeFormat) : ""}
            </span>
            {isMine && status && <StatusIcon status={status} />}
          </div>
        )}
        {!hasCaption && isTemp && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className="text-[10px] text-white/80">Sending…</span>
          </div>
        )}
      </div>
    );
  }

  const visible = imgs.slice(0, 4);
  const extra = imgs.length - 4;

  return (
    <div className="grid gap-0.5 w-[248px] grid-cols-2">
      {visible.map((img: any, i: number) => {
        const isLast = i === 3 && extra > 0;
        const absoluteIndex = mediaAtts.findIndex(
          (a: any) => a.url === img.url,
        );
        return (
          <div
            key={i}
            className={cn(
              "relative overflow-hidden cursor-pointer group/cell",
              imgs.length === 2 ? "h-[140px]" : "h-[112px]",
              i === 0 && "rounded-tl-2xl",
              i === 1 && "rounded-tr-2xl",
              i === 2 && imgs.length <= 3 && "rounded-bl-sm",
              i === 3 && "rounded-br-sm",
              imgs.length === 3 &&
                i === 2 &&
                "col-span-2 rounded-b-xl h-[112px]",
            )}
            onClick={() => onOpen(absoluteIndex >= 0 ? absoluteIndex : 0)}
          >
            <img
              src={img.url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover/cell:scale-105"
            />
            {isLast && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                <span className="text-white text-2xl font-semibold">
                  +{extra + 1}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

//
//  MessageBubble (main export)
//

export default function MessageBubble({ message }: { message: Message }) {
  const { myId } = useAuthStore();
  const { openCtx } = useChatStore();
  const { fontStyle, textSize, bubbleStyle, compactMode, timeFormat } =
    useAppearanceStore();

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showReactionModal, setShowReactionModal] = useState(false);
  const isMine = message.senderId === myId;
  const isDeleted = message.is_deleted_for_everyone;
  const isTemp = (message as any).isTemp === true;
  const attachments: any[] = (message as any).attachments ?? [];
  const uploadProgress = (message as any).uploadProgress ?? 0;

  //  Normalize forwarded flag (DB: is_forwarded, type: isForwarded)
  const isForwarded =
    message.isForwarded ?? (message as any).is_forwarded ?? false;

  //  Normalize reactions (DB: [] or [{emoji, userIds}], type: object map)
  const reactions = normalizeReactions(message.reactions);
  const hasReactions = Object.values(reactions).some((u) => u.length > 0);

  const contentStr = safeStr(message.content);
  const hasCaption = !!contentStr.trim();

  const mediaAtts = attachments.filter(
    (a) => a.type === "image" || a.type === "video",
  );
  const voiceAtts = attachments.filter((a) => a.type === "VoiceMessage");
  const fileAtts = attachments.filter(
    (a) => a.type === "file" || a.type === "audio",
  );

  const hasMedia = mediaAtts.length > 0;
  const hasVoice = voiceAtts.length > 0;
  const hasFiles = fileAtts.length > 0;

  const textRadius =
    bubbleStyle === "modern"
      ? isMine
        ? "rounded-2xl rounded-br-sm"
        : "rounded-2xl rounded-bl-sm"
      : bubbleStyle === "classic"
        ? "rounded-lg"
        : "rounded-none";

  const mediaRadius = isMine
    ? "rounded-2xl rounded-br-sm overflow-hidden"
    : "rounded-2xl rounded-bl-sm overflow-hidden";

  const scrollToReply = () => {
    if (!message.replyTo?._id) return;
    const el = document.getElementById(`message-${message.replyTo._id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(
      "opacity-50",
      "scale-[1.02]",
      "transition-all",
      "duration-300",
    );
    setTimeout(() => el.classList.remove("opacity-50", "scale-[1.02]"), 800);
  };

  const renderCtxBtn = (className?: string) =>
    !isTemp ? (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openCtx(e, message, isMine);
        }}
        className={cn(
          "z-20 p-1 rounded-full transition-all duration-200",
          "opacity-100 md:opacity-0 md:group-hover:opacity-100",
          isMine
            ? "bg-black/20 text-white hover:bg-black/40"
            : "bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-black/20",
          className,
        )}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    ) : null;

  //
  // Media / attachment bubble
  //
  if ((hasMedia || hasVoice || hasFiles) && !isDeleted) {
    const videoAtts = mediaAtts.filter((a) => a.type === "video");

    return (
      <>
        <style>{bubbleAnimStyles}</style>

        {viewerOpen && (
          <MediaViewer
            items={mediaAtts.map((a) => ({
              url: a.url,
              type: a.type,
              name: a.name,
              publicId: a.publicId,
            }))}
            initialIndex={viewerIndex}
            caption={contentStr}
            sentAt={
              message.createdAt
                ? timeFormatFn(message.createdAt, timeFormat)
                : undefined
            }
            onClose={() => setViewerOpen(false)}
          />
        )}

        <div
          id={`message-${message._id}`}
          className={cn(
            "relative flex items-end gap-2 group bubble-enter",
            compactMode ? "mb-0.5" : "mb-2",
            isMine ? "ml-auto flex-row-reverse" : "mr-auto",
            "max-w-[75%]",
          )}
        >
          <div className="flex flex-col">
            <div
              onContextMenu={(e) => !isTemp && openCtx(e, message, isMine)}
              className={cn(
                "relative shadow-lg",
                mediaRadius,
                isMine
                  ? "shadow-sky-500/20"
                  : "shadow-slate-200/60 dark:shadow-slate-900/40",
              )}
            >
              {renderCtxBtn("absolute top-2 right-2")}

              {/*  Forwarded label (media bubble)  */}
              {isForwarded && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-[10px] px-3 pt-2 pb-0 select-none",
                    isMine
                      ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white/50"
                      : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-x border-t border-slate-200/80 dark:border-slate-700/80 rounded-t-2xl",
                  )}
                >
                  <Forward className="h-3 w-3" />
                  <span>Forwarded</span>
                </div>
              )}

              {/* Reply preview */}
              {message.replyTo && (
                <div
                  className={cn(
                    "px-2.5 pt-2.5",
                    isMine
                      ? "bg-gradient-to-br from-sky-500 to-blue-600 rounded-t-2xl"
                      : "bg-white dark:bg-slate-800 rounded-t-2xl border-x border-t border-slate-200/80 dark:border-slate-700/80",
                    // If forwarded label already rendered, don't re-round top
                    isForwarded && "rounded-t-none",
                  )}
                >
                  <ReplyPreview
                    replyTo={message.replyTo}
                    myId={myId}
                    isMine={isMine}
                    onClick={scrollToReply}
                  />
                </div>
              )}

              {/* Image grid */}
              {hasMedia && (
                <MessageImageGrid
                  mediaAtts={mediaAtts}
                  hasCaption={hasCaption}
                  isMine={isMine}
                  isTemp={isTemp}
                  progress={uploadProgress}
                  createdAt={message.createdAt}
                  timeFormat={timeFormat}
                  status={message.status}
                  isImportant={message.isImportant}
                  onOpen={(index) => {
                    setViewerIndex(index);
                    setViewerOpen(true);
                  }}
                />
              )}

              {/* Video player */}
              {videoAtts.map((v: any, i: number) => {
                const absoluteIndex = mediaAtts.findIndex(
                  (a) => a.url === v.url,
                );
                return (
                  <VideoPlayer
                    key={i}
                    url={v.url}
                    publicId={v.publicId}
                    name={v.name}
                    size={v.size}
                    isMine={isMine}
                    disabled={isTemp}
                    onExpand={() => {
                      setViewerIndex(absoluteIndex >= 0 ? absoluteIndex : 0);
                      setViewerOpen(true);
                    }}
                  />
                );
              })}

              {/* Voice messages */}
              {voiceAtts.map((a: any, i: number) => (
                <VoicePlayer
                  key={i}
                  url={a.url}
                  name={a.name}
                  size={a.size}
                  isMine={isMine}
                  initialDuration={a.duration ?? null}
                />
              ))}

              {/* Generic file / audio */}
              {fileAtts.map((f: any, i: number) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 w-[256px]",
                    isMine
                      ? "bg-gradient-to-br from-sky-500 to-blue-600"
                      : "bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80",
                  )}
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      isMine
                        ? "bg-white/15 ring-1 ring-white/20"
                        : "bg-slate-100 dark:bg-slate-700/80 ring-1 ring-slate-200 dark:ring-slate-600",
                    )}
                  >
                    <FileIcon mimeType={f.mimeType} className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-xs font-semibold truncate",
                        isMine
                          ? "text-white"
                          : "text-slate-700 dark:text-slate-100",
                      )}
                    >
                      {f.name}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] mt-0.5 font-medium",
                        isMine
                          ? "text-white/55"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      {sizeLabel(f.size)}
                      {f.mimeType && (
                        <> · {f.mimeType.split("/")[1]?.toUpperCase()}</>
                      )}
                    </p>
                  </div>
                  <DownloadBtn url={f.url} name={f.name} isMine={isMine} />
                </div>
              ))}

              {/* Caption bar */}
              {hasCaption && (
                <div
                  className={cn(
                    "flex items-end justify-between gap-2 px-3 py-2.5",
                    isMine
                      ? "bg-gradient-to-br from-sky-500 to-blue-600 rounded-b-2xl rounded-br-sm"
                      : "bg-white dark:bg-slate-800/90 rounded-b-2xl rounded-bl-sm border-x border-b border-slate-200/80 dark:border-slate-700/80",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm flex-1 leading-relaxed",
                      isMine
                        ? "text-white"
                        : "text-slate-700 dark:text-slate-100",
                    )}
                  >
                    {contentStr}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {message.isImportant && (
                      <Star
                        className={cn(
                          "h-2.5 w-2.5 fill-current",
                          isMine ? "text-amber-300" : "text-amber-400",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        isMine ? "text-white/55" : "text-slate-400",
                      )}
                    >
                      {isTemp ? (
                        "Sending…"
                      ) : (
                        <>
                          {dateLabelFn(message.createdAt) && (
                            <span
                              className={cn(
                                "mr-1",
                                isMine
                                  ? "text-white/40"
                                  : "text-slate-300 dark:text-slate-500",
                              )}
                            >
                              {dateLabelFn(message.createdAt)}
                            </span>
                          )}
                          {timeFormatFn(message.createdAt!, timeFormat)}
                        </>
                      )}
                    </span>
                    {isMine && message.status && !isTemp && (
                      <StatusIcon status={message.status} />
                    )}
                  </div>
                </div>
              )}

              {/* Standalone footer (voice/file/video, no caption, no image) */}
              {!hasCaption &&
                mediaAtts.filter((a) => a.type === "image").length === 0 &&
                (hasVoice || hasFiles || videoAtts.length > 0) && (
                  <div
                    className={cn(
                      "flex justify-end items-center gap-1 px-3 py-1.5",
                      isMine
                        ? "bg-gradient-to-br from-sky-500 to-blue-600 rounded-b-2xl rounded-br-sm"
                        : "bg-white dark:bg-slate-800/90 rounded-b-2xl rounded-bl-sm border-x border-b border-slate-200/80 dark:border-slate-700/80",
                    )}
                  >
                    {message.isImportant && (
                      <Star
                        className={cn(
                          "h-2.5 w-2.5 fill-current",
                          isMine ? "text-amber-300" : "text-amber-400",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        isMine ? "text-white/55" : "text-slate-400",
                      )}
                    >
                      {isTemp
                        ? "Sending…"
                        : message.createdAt && (
                            <>
                              {dateLabelFn(message.createdAt) && (
                                <span
                                  className={cn(
                                    "mr-1",
                                    isMine
                                      ? "text-white/40"
                                      : "text-slate-300 dark:text-slate-500",
                                  )}
                                >
                                  {dateLabelFn(message.createdAt)}
                                </span>
                              )}
                              {timeFormatFn(message.createdAt, timeFormat)}
                            </>
                          )}
                    </span>
                    {isMine && message.status && !isTemp && (
                      <StatusIcon status={message.status} />
                    )}
                  </div>
                )}
            </div>

            {/*  Reactions (below media bubble)  */}
            {hasReactions && (
              <ReactionBar
                reactions={reactions}
                myId={myId}
                isMine={isMine}
                onClick={() => setShowReactionModal(true)}
              />
            )}
          </div>
        </div>
      </>
    );
  }

  //
  // Text bubble
  //
  return (
    <>
      <style>{bubbleAnimStyles}</style>
      <div
        id={`message-${message._id}`}
        className={cn(
          "relative flex items-end gap-2 group bubble-enter transition-all duration-200",
          compactMode ? "mb-0.5" : "mb-3",
          isMine ? "ml-auto flex-row-reverse" : "mr-auto",
          "max-w-[80%]",
        )}
      >
        <div className="flex flex-col">
          <div
            onContextMenu={(e) => !isDeleted && openCtx(e, message, isMine)}
            className={cn(
              "relative cursor-context-menu select-text leading-relaxed",
              "transition-all duration-150",
              "shadow-md",
              fontStyle,
              textSize,
              textRadius,
              compactMode ? "px-3 py-1.5" : "px-4 py-2.5",
              isMine
                ? [
                    "bg-gradient-to-br from-sky-500 to-blue-600 text-white",
                    "shadow-sky-500/25",
                    "ring-1 ring-white/10",
                  ].join(" ")
                : [
                    "bg-white text-slate-700",
                    "border border-slate-200/80",
                    "shadow-slate-200/60",
                    "dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-700/80 dark:shadow-slate-900/40",
                  ].join(" "),
              isDeleted && "opacity-60 italic",
              "hover:shadow-lg hover:-translate-y-[1px]",
            )}
          >
            {/* Context menu trigger */}
            {!isDeleted && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openCtx(e, message, isMine);
                }}
                className={cn(
                  "absolute top-1.5 right-1.5 p-0.5 rounded-full z-10 transition-all duration-200",
                  "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                  isMine
                    ? "bg-white/10 text-white hover:bg-white/25"
                    : "bg-slate-100 dark:bg-slate-700/80 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600",
                )}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}

            <div className="flex flex-col gap-0.5 pr-2">
              {/*  Forwarded label (text bubble)  */}
              {isForwarded && !isDeleted && <ForwardedLabel isMine={isMine} />}

              {/* Reply preview */}
              {message.replyTo && !isDeleted && (
                <ReplyPreview
                  replyTo={message.replyTo}
                  myId={myId}
                  isMine={isMine}
                  onClick={scrollToReply}
                />
              )}

              {isDeleted ? (
                <span className="flex items-center gap-1.5 text-xs opacity-70">
                  <Ban className="h-3.5 w-3.5 shrink-0" />
                  This message was deleted
                </span>
              ) : (
                <>
                  <LinkPreviewCard content={contentStr} isMine={isMine} />
                  <span className="whitespace-pre-wrap break-words mt-0.5 leading-[1.55]">
                    {contentStr}
                  </span>
                </>
              )}

              {/* Meta row */}
              <div
                className={cn(
                  "flex items-center justify-end gap-1 select-none",
                  compactMode ? "mt-0" : "mt-1",
                )}
              >
                {message.isImportant && (
                  <Star
                    className={cn(
                      "h-2.5 w-2.5 fill-current",
                      isMine ? "text-amber-300" : "text-amber-400",
                    )}
                  />
                )}
                {message.is_edited && !isDeleted && (
                  <span
                    className={cn(
                      "text-[9px] uppercase font-bold tracking-widest",
                      isMine ? "text-white/40" : "text-slate-400",
                    )}
                  >
                    edited
                  </span>
                )}
                <span
                  className={cn(
                    "text-[10px] font-medium tabular-nums",
                    isMine
                      ? "text-white/55"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {isTemp
                    ? "Sending…"
                    : message.createdAt &&
                      timeFormatFn(message.createdAt, timeFormat)}
                </span>
                {isMine && message.status && !isTemp && (
                  <StatusIcon status={message.status} />
                )}
              </div>
            </div>
          </div>

          {/*  Reactions (below text bubble)  */}
          {hasReactions && (
            <ReactionBar
              reactions={reactions}
              myId={myId}
              isMine={isMine}
              onClick={() => setShowReactionModal(true)}
            />
          )}
        </div>
      </div>
      {showReactionModal && (
        <ReactionDetailsModal
          reactionMap={reactions}
          onClose={() => setShowReactionModal(false)}
        />
      )}
    </>
  );
}
