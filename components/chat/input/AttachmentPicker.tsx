// components/AttachmentPicker.tsx
"use client";
import { useRef } from "react";
import {
  Paperclip,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
} from "lucide-react";
import { useMediaStore } from "@/stores/mediaStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fallbackMimeTypes: Record<string, string> = {
  js: "application/javascript",
  ts: "application/typescript",
  json: "application/json",
  jsx: "text/jsx",
  tsx: "text/tsx",
  py: "text/x-python",
  r: "text/plain", // R Language
  java: "text/x-java-source",
  cpp: "text/x-c",
  c: "text/x-c",
  go: "text/x-go",
  php: "application/x-httpd-php",
  sql: "application/sql",

  // Documents & Archives
  rar: "application/vnd.rar",
  csv: "text/csv",
  txt: "text/plain",
};

export function AttachmentPicker() {
  const { addFiles, isUploading } = useMediaStore();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files ?? []);
    if (!rawFiles.length) return;

    const processedFiles = rawFiles.map((file) => {
      if (!file.type) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";

        const mimeType = fallbackMimeTypes[ext] || "application/octet-stream";

        return new File([file], file.name, {
          type: mimeType,
          lastModified: file.lastModified,
        });
      }
      return file;
    });

    const { ok, error } = await addFiles(processedFiles);
    if (!ok && error) toast.error(error);
    e.target.value = "";
  };

  const btns = [
    {
      ref: imageRef,
      icon: ImageIcon,
      label: "Image",
      accept: "image/*",
      multiple: true,
    },
    {
      ref: videoRef,
      icon: Film,
      label: "Video",
      accept: "video/mp4,video/webm,video/quicktime",
      multiple: false,
    },
    {
      ref: audioRef,
      icon: Music,
      label: "Audio",
      accept: "audio/*",
      multiple: false,
    },
    {
      ref: fileRef,
      icon: FileText,
      label: "File",
      accept: ".pdf,.zip,.rar,.doc,.docx,.xls,.xlsx,.txt,.csv,.js,.ts",
      multiple: true,
    },
  ];

  return (
    <div className="relative group/picker">
      {/* trigger */}
      <Button
        variant="ghost"
        size="icon"
        disabled={isUploading}
        className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Paperclip className="h-4.5 w-4.5 text-slate-400 hover:text-sky-500 transition-colors" />
      </Button>

      {/* popup menu */}
      <div
        className={cn(
          "absolute bottom-11 left-0 z-50",
          "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg p-1.5",
          "flex flex-col gap-0.5 min-w-[120px]",
          "opacity-0 pointer-events-none scale-95 origin-bottom-left",
          "group-focus-within/picker:opacity-100 group-focus-within/picker:pointer-events-auto group-focus-within/picker:scale-100",
          "group-hover/picker:opacity-100 group-hover/picker:pointer-events-auto group-hover/picker:scale-100",
          "transition-all duration-150",
        )}
      >
        {btns.map(({ ref, icon: Icon, label, accept, multiple }) => (
          <button
            key={label}
            onClick={() => ref.current?.click()}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon className="h-4 w-4 text-sky-500" />
            {label}
            <input
              ref={ref}
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handle}
              className="hidden"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

