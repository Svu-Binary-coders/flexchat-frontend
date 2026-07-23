/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useRef, useEffect, useState } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  X,
  CornerUpRight,
  Pencil,
  Film,
  Music,
  FileText,
  Plus,
  Loader2,
  Check,
  Mic,
  Trash2,
  Square,
  ExternalLink,
} from "lucide-react";
import { useLinkPreview } from "@/hooks/useLinkPreview";
import { useChatStore } from "@/stores/chatStore";
import {
  useMediaStore,
  SelectedMedia,
  UploadingMedia,
} from "@/stores/mediaStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { extractUrl } from "@/lib/linkDetector";
import { FileIcon } from "../chat-window/MessageBubble";
import Image from "next/image";

const MAX_FILES = 5;

function FileTypeIcon({ type }: { type: string }) {
  if (type === "video") return <Film className="h-6 w-6 text-purple-400" />;
  if (type === "audio") return <Music className="h-6 w-6 text-green-400" />;
  return <FileText className="h-6 w-6 text-orange-400" />;
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const safeStr = (val: unknown): string => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = val as any;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
  }
  return "";
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function CircularProgress({
  progress,
  done,
}: {
  progress: number;
  done: boolean;
}) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
      {done ? (
        <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
          <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
      ) : (
        <div className="relative flex items-center justify-center">
          <svg width="52" height="52" className="-rotate-90">
            <circle
              cx="26"
              cy="26"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="4"
            />
            <circle
              cx="26"
              cy="26"
              r={r}
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.2s ease-out" }}
            />
          </svg>
          <span className="absolute text-[11px] font-bold text-white tabular-nums">
            {progress}%
          </span>
        </div>
      )}
    </div>
  );
}

function UploadingThumb({ item }: { item: UploadingMedia }) {
  return (
    <div className="relative shrink-0 h-16 w-16">
      {item.type === "image" && item.previewUrl ? (
        <img
          src={item.previewUrl}
          alt={item.name}
          className="h-full w-full object-cover rounded-xl"
        />
      ) : (
        <div className="h-full w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center gap-0.5 px-1">
          <FileTypeIcon type={item.type} />
          <span className="text-[8px] text-slate-400">
            {sizeLabel(item.size)}
          </span>
        </div>
      )}
      <CircularProgress progress={item.progress} done={item.done} />
      <span
        className={cn(
          "absolute top-0.5 left-0.5 text-[8px] font-bold px-1 py-0.5 rounded-md uppercase",
          item.type === "image" && "bg-sky-500/80 text-white",
          item.type === "video" && "bg-purple-500/80 text-white",
          item.type === "audio" && "bg-green-500/80 text-white",
          item.type === "file" && "bg-orange-500/80 text-white",
        )}
      >
        {item.type}
      </span>
    </div>
  );
}

function PendingThumb({
  item,
  onRemove,
}: {
  item: SelectedMedia;
  onRemove: () => void;
}) {
  return (
    <div className="relative shrink-0 group/thumb h-16 w-16">
      {item.type === "image" ? (
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="h-full w-full object-cover rounded-xl border-2 border-sky-200 dark:border-sky-800"
        />
      ) : (
        <div className="h-full w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center gap-0.5 px-1">
          <FileTypeIcon type={item.type} />
          <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate w-full text-center px-0.5 leading-tight">
            {item.file.name.length > 10
              ? item.file.name.slice(0, 8) + "…"
              : item.file.name}
          </span>
          <span className="text-[8px] text-slate-400">
            {sizeLabel(item.file.size)}
          </span>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-sm"
      >
        <X className="h-3 w-3" />
      </button>
      <span
        className={cn(
          "absolute bottom-0.5 left-0.5 text-[8px] font-bold px-1 py-0.5 rounded-md uppercase",
          item.type === "image" &&
            "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
          item.type === "video" &&
            "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
          item.type === "audio" &&
            "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
          item.type === "file" &&
            "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
        )}
      >
        {item.type}
      </span>
    </div>
  );
}

export default function InputBar() {
  const {
    msgInput,
    sendMessage,
    editingMsg,
    replyTo,
    showEmojiPicker,
    setShowEmojiPicker,
    activeContact,
    addOptimisticMessage,
    replaceTempMessage,
    removeTempMessage,
  } = useChatStore();

  const {
    selectedMedias,
    uploadingMedias,
    isUploading,
    addFiles,
    removeFile,
    clearMedia,
    uploadAndConfirm,
    uploadVoice,
  } = useMediaStore();

  const {
    isRecording,
    recordingTime,
    compressedAudioFile,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceStore();

  const [localInput, setLocalInput] = useState("");
  const [debouncedUrl, setDebouncedUrl] = useState<string | null>(null);
  const [hideLinkPreview, setHideLinkPreview] = useState(false);

  //  Refs
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const storeUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const isEmittingTypingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  //  Store -> local sync (emoji, edit prefill, Esc clear)
  useEffect(() => {
    setLocalInput(msgInput);
  }, [msgInput]);

  useEffect(() => {
    if (replyTo || editingMsg) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [replyTo, editingMsg]);

  //  Link preview debounce
  useEffect(() => {
    if (!msgInput.trim()) {
      setDebouncedUrl(null);
      setHideLinkPreview(false);
      return;
    }
    const handler = setTimeout(() => {
      const url = extractUrl(msgInput);
      const isValidDomain =
        /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(url || "");
      setDebouncedUrl(url && isValidDomain ? url : null);
    }, 500);
    return () => clearTimeout(handler);
  }, [msgInput]);

  const { data: livePreview, isLoading: isPreviewLoading } = useLinkPreview(
    debouncedUrl && !hideLinkPreview ? debouncedUrl : null,
  );

  //  Input change — local fast, store debounced, typing chatRoomId
  const handleLocalChange = (value: string) => {
    // 1. Local state — instant
    setLocalInput(value);

    clearTimeout(storeUpdateTimerRef.current);
    storeUpdateTimerRef.current = setTimeout(() => {
      useChatStore.setState({ msgInput: value });
    }, 20);

    if (!activeContact?.customChatId) return;
    const socket = useChatStore.getState().socket;

    if (!isEmittingTypingRef.current) {
      socket?.emit("typing", { chatRoomId: activeContact.customChatId });
      isEmittingTypingRef.current = true;
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket?.emit("stop_typing", { chatRoomId: activeContact.customChatId });
      isEmittingTypingRef.current = false;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      clearTimeout(storeUpdateTimerRef.current);
      if (isEmittingTypingRef.current && activeContact?.customChatId) {
        useChatStore.getState().socket?.emit("stop_typing", {
          chatRoomId: activeContact.customChatId,
        });
        isEmittingTypingRef.current = false;
      }
    };
  }, [activeContact]);

  const pickers = [
    {
      id: "picker-image",
      icon: ImageIcon,
      label: "Image",
      accept: "image/jpeg,image/png,image/webp,image/gif",
      multiple: true,
    },
    {
      id: "picker-video",
      icon: Film,
      label: "Video",
      accept: "video/mp4,video/webm,video/quicktime",
      multiple: false,
    },
    {
      id: "picker-audio",
      icon: Music,
      label: "Audio",
      accept: "audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4",
      multiple: false,
    },
    {
      id: "picker-file",
      icon: FileText,
      label: "File",
      accept:
        ".pdf,.zip,.rar,.doc,.docx,.xls,.xlsx,.txt,.csv,.tsx,.ts,.js,.jsx,.json,.md,.ppt,.pptx,.epub,.apk,.exe,.dmg,.iso,.bin,.img,.7z",
      multiple: true,
    },
  ] as const;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    addFiles(files).then(({ ok, error }) => {
      if (!ok && error) toast.error(error);
    });
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const fileItems = items.filter((item) => item.kind === "file");
    if (fileItems.length === 0) return;

    e.preventDefault();

    const files = fileItems
      .map((item) => item.getAsFile())
      .filter(Boolean) as File[];

    if (files.length === 0) return;

    // MAX_FILES check
    const remaining = MAX_FILES - selectedMedias.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    addFiles(files.slice(0, remaining)).then(({ ok, error }) => {
      if (!ok && error) toast.error(error);
    });
  };

  const handleEmojiClick = (emojiObject: EmojiClickData) => {
    useChatStore.setState({ msgInput: localInput + emojiObject.emoji });
    inputRef.current?.focus();
  };

  const clearContext = () => {
    useChatStore.setState({ editingMsg: null, replyTo: null, msgInput: "" });
    inputRef.current?.focus();
  };

  const onSendMessage = async () => {
    if (!activeContact?.customChatId) return;

    clearTimeout(typingTimerRef.current);
    clearTimeout(storeUpdateTimerRef.current);
    useChatStore.setState({ msgInput: localInput });
    if (isEmittingTypingRef.current) {
      useChatStore.getState().socket?.emit("stop_typing", {
        chatRoomId: activeContact.customChatId,
      });
      isEmittingTypingRef.current = false;
    }

    // Voice
    if (compressedAudioFile) {
      if (isUploading) return;
      await uploadVoice(
        compressedAudioFile,
        activeContact.customChatId,
        (tempMsg) => addOptimisticMessage(tempMsg),
        (realData) => replaceTempMessage(realData.tempId, realData),
        (tempId) => {
          removeTempMessage(tempId);
          toast.error("Failed to send voice message");
        },
      );
      cancelRecording();
      return;
    }

    // Media
    if (selectedMedias.length > 0) {
      if (isUploading) return;
      const text = localInput.trim();
      setLocalInput("");
      useChatStore.setState({ msgInput: "" });
      inputRef.current?.focus();
      await uploadAndConfirm(
        activeContact.customChatId,
        text,
        (tempMsg) => addOptimisticMessage(tempMsg),
        (realData) => replaceTempMessage(realData.tempId, realData),
        (tempId) => {
          removeTempMessage(tempId);
          toast.error("Failed to send media");
        },
      );
      return;
    }

    // Text
    if (localInput.trim()) {
      sendMessage();
      setLocalInput("");
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
    if (e.key === "Escape") {
      setLocalInput("");
      useChatStore.setState({ editingMsg: null, replyTo: null, msgInput: "" });
      setShowEmojiPicker(false);
      clearMedia();
      cancelRecording();
    }
  };

  const openPicker = (id: string) => document.getElementById(id)?.click();

  const hasContent =
    localInput.trim().length > 0 ||
    selectedMedias.length > 0 ||
    !!compressedAudioFile;

  return (
    <div className="relative border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 px-4 py-3 shrink-0 transition-colors duration-200">
      {/* Hidden file inputs */}
      {pickers.map(({ id, accept, multiple, label }) => (
        <input
          key={label}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
        />
      ))}
      {/* Emoji picker */}
      {showEmojiPicker && (
        <div
          ref={emojiRef}
          className="absolute bottom-20 right-4 z-50 animate-in slide-in-from-bottom-5 duration-200 shadow-2xl rounded-2xl overflow-hidden"
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.AUTO}
            searchDisabled={false}
            skinTonesDisabled={true}
            width={320}
            height={400}
          />
        </div>
      )}

      {/* reply  */}
      {replyTo &&
        !editingMsg &&
        (() => {
          const atts = (replyTo as any).attachments ?? [];
          const imgs = atts.filter((a: any) => a.type === "image");
          const vids = atts.filter((a: any) => a.type === "video");
          const files = atts.filter(
            (a: any) => a.type === "file" || a.type === "audio",
          );
          const voices = atts.filter((a: any) => a.type === "VoiceMessage");
          const hasAtts = atts.length > 0 || (replyTo as any).hasAttachments;
          const msgType = (replyTo as any).messageType;
          const senderName =
            (replyTo as any).senderDetails?.userName ?? "Unknown";
          const textContent = safeStr((replyTo as any).content);

          const getPreviewLabel = () => {
            if (imgs.length > 0) return "Photo";
            if (vids.length > 0) return "Video";
            if (voices.length > 0) return "Voice message";
            if (files.length > 0) return files[0].name ?? "File";
            if (hasAtts) {
              if (msgType === "media") return "Photo";
              if (msgType === "voice") return "Voice message";
              if (msgType === "file") return "File";
            }
            return textContent || "Message";
          };

          return (
            <div className="relative flex items-center gap-3 mb-3 pl-3 pr-10 py-2.5 rounded-xl bg-sky-50/80 border-l-4 border-sky-400 dark:bg-sky-950/30 dark:border-sky-500 animate-in slide-in-from-bottom-2 duration-200">
              {imgs.length > 0 ? (
                <Image
                  src={(imgs[0].url as string) || "/default_image.png"}
                  alt="reply preview"
                  className="w-13 h-13 rounded-lg object-cover shrink-0 ring-1 ring-sky-200 dark:ring-sky-800"
                  width={52}
                  height={52}
                />
              ) : files.length > 0 ? (
                <div className="w-13 h-13 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                  <FileIcon mimeType={files[0].mimeType} className="h-6 w-6" />
                </div>
              ) : vids.length > 0 ? (
                <div className="w-13 h-13 rounded-lg bg-slate-800 relative overflow-hidden shrink-0">
                  <Image
                    src={vids[0].url.replace(/\.(mp4|mov|webm)$/, ".jpg")}
                    alt="video reply"
                    className="w-full h-full object-cover opacity-70"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                    loading="lazy"
                  />
                  <Film className="absolute inset-0 m-auto h-5 w-5 text-white" />
                </div>
              ) : voices.length > 0 ? (
                <div className="w-13 h-13 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0">
                  <Mic className="h-6 w-6 text-sky-500" />
                </div>
              ) : hasAtts && atts.length === 0 ? (
                <div className="w-13 h-13 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0">
                  {msgType === "media" && (
                    <ImageIcon className="h-6 w-6 text-sky-500" />
                  )}
                  {msgType === "voice" && (
                    <Mic className="h-6 w-6 text-sky-500" />
                  )}
                  {msgType === "file" && (
                    <FileText className="h-6 w-6 text-sky-500" />
                  )}
                </div>
              ) : null}

              {/* Text content — sender name + preview */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                  <CornerUpRight className="h-3 w-3" />
                  Replying to {senderName}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate mt-0.5">
                  {getPreviewLabel()}
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={clearContext}
                className="absolute top-1/2 -translate-y-1/2 right-2 h-7 w-7 rounded-full hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })()}

      {/* Live Link Preview */}
      {debouncedUrl &&
        !hideLinkPreview &&
        (isPreviewLoading || livePreview?.title) && (
          <div className="relative flex items-center gap-3 mb-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 animate-in slide-in-from-bottom-2 duration-200">
            {isPreviewLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 w-full">
                <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                <span>Loading preview...</span>
              </div>
            ) : (
              <>
                {livePreview?.image ? (
                  <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img
                      src={livePreview.image}
                      alt="preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {livePreview?.title ||
                      livePreview?.siteName ||
                      "Unknown Link"}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {livePreview?.description ||
                      (() => {
                        try {
                          return new URL(
                            debouncedUrl.startsWith("http")
                              ? debouncedUrl
                              : `https://${debouncedUrl}`,
                          ).hostname;
                        } catch {
                          return debouncedUrl;
                        }
                      })()}
                  </span>
                </div>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHideLinkPreview(true)}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

      {/* Media strip */}
      {(selectedMedias.length > 0 || uploadingMedias.length > 0) && (
        <div className="flex items-end gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
          {selectedMedias.map((m) => (
            <PendingThumb
              key={m.id}
              item={m}
              onRemove={() => removeFile(m.id)}
            />
          ))}
          {uploadingMedias.map((m) => (
            <UploadingThumb key={m.id} item={m} />
          ))}
          {!isUploading &&
            selectedMedias.length < MAX_FILES &&
            selectedMedias.length > 0 && (
              <button
                onClick={() => openPicker("picker-image")}
                className="h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-sky-400 hover:text-sky-500 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span className="text-[9px]">Add more</span>
              </button>
            )}
        </div>
      )}
      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attachment picker */}
        <div className="relative group/picker mb-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={isUploading || isRecording}
            className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 disabled:opacity-40"
          >
            <Paperclip className="h-4.5 w-4.5 text-slate-400" />
          </Button>
          <div
            className={cn(
              "absolute bottom-11 left-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg p-1.5 flex flex-col gap-0.5 min-w-[130px]",
              "opacity-0 pointer-events-none scale-95 origin-bottom-left",
              "group-focus-within/picker:opacity-100 group-focus-within/picker:pointer-events-auto group-focus-within/picker:scale-100",
              "group-hover/picker:opacity-100 group-hover/picker:pointer-events-auto group-hover/picker:scale-100",
              "transition-all duration-150",
            )}
          >
            {pickers.map(({ id, icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => openPicker(id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <Icon className="h-4 w-4 text-sky-500 shrink-0" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Input Area */}
        <div
          className={cn(
            "flex-1 flex items-center min-h-[44px] gap-2 border rounded-2xl px-2 transition-all duration-200",
            isRecording || compressedAudioFile
              ? "bg-slate-50 border-sky-200 dark:bg-slate-900/50 dark:border-sky-900/50"
              : "bg-slate-50 border-slate-200 focus-within:bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 dark:bg-slate-950 dark:border-slate-800 dark:focus-within:bg-slate-900 dark:focus-within:border-sky-500 dark:focus-within:ring-sky-900/30",
          )}
        >
          {isRecording ? (
            <div className="flex flex-1 items-center justify-between px-2 w-full">
              <div className="flex items-center gap-2 text-red-500 animate-pulse">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="font-medium text-sm tabular-nums">
                  {formatTime(recordingTime)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cancelRecording}
                  className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-full"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopRecording}
                  className="h-8 w-8 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/50 rounded-full"
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              </div>
            </div>
          ) : compressedAudioFile ? (
            <div className="flex flex-1 items-center gap-3 px-2 w-full">
              <audio
                controls
                src={URL.createObjectURL(compressedAudioFile)}
                className="h-8 flex-1 max-w-[200px]"
              />
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelRecording}
                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-full shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                value={localInput}
                onChange={(e) => handleLocalChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  selectedMedias.length > 0 || uploadingMedias.length > 0
                    ? "Add a caption or write a message..."
                    : "Write your message here..."
                }
                className="flex-1 bg-transparent text-[15px] px-2 py-2.5 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none w-full"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0"
              >
                <Smile className="h-4 w-4 text-slate-400 hover:text-amber-500 transition-colors" />
              </Button>
            </>
          )}
        </div>

        {/* Send / Mic button */}
        {!hasContent && !isRecording && !compressedAudioFile ? (
          <Button
            onClick={startRecording}
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-2xl shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Mic className="h-5 w-5 text-slate-500" />
          </Button>
        ) : (
          <Button
            onClick={onSendMessage}
            disabled={(!hasContent && !isRecording) || isUploading}
            size="icon"
            className={cn(
              "relative h-11 w-11 rounded-2xl shrink-0 transition-all duration-200 shadow-sm overflow-hidden",
              isRecording ? "hidden" : "flex",
              "bg-sky-500 hover:bg-sky-600 text-white dark:bg-sky-600 dark:hover:bg-sky-500",
              "disabled:opacity-80 disabled:cursor-not-allowed",
            )}
          >
            {isUploading ? (
              <Loader2 className="relative h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {/* Keyboard hints */}
      <div className="hidden md:flex justify-center items-center gap-2 mt-3 text-[10px] font-medium text-slate-400 dark:text-slate-500 select-none">
        <span>
          Press
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 dark:text-slate-400 mx-0.5 font-sans">
            Enter
          </kbd>
          to send
        </span>
        <span className="opacity-50">•</span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 dark:text-slate-400 mx-0.5 font-sans">
            Esc
          </kbd>
          to cancel
        </span>
      </div>
    </div>
  );
}
