"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Volume2, VolumeX, Maximize2, Check } from "lucide-react";
import { getVideoThumbnail } from "@/lib/cloudinary.helpers";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url: string;
  publicId?: string | null;
  name?: string;
  size?: number;
  isMine: boolean;
  hasCaption?: boolean;
  disabled?: boolean;
  uploadProgress?: number;
  isGrid?: boolean; // নতুন প্রপার্টি: গ্রিড লেআউটের জন্য
  onExpand?: () => void;
}

const sizeLabel = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

function CircularProgress({
  progress,
  done,
}: {
  progress: number;
  done: boolean;
}) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      {done || progress === 100 ? (
        <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-300 scale-in">
          <Check className="h-6 w-6 text-white" strokeWidth={3} />
        </div>
      ) : (
        <>
          <div className="absolute inset-0 bg-black/40 rounded-full backdrop-blur-sm shadow-inner" />
          <svg
            width="60"
            height="60"
            className="-rotate-90 relative z-10 drop-shadow-md"
          >
            <circle
              cx="30"
              cy="30"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="3.5"
            />
            <circle
              cx="30"
              cy="30"
              r={r}
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-300 ease-out"
            />
          </svg>
          <span className="absolute text-[11px] font-bold text-white tabular-nums tracking-tighter z-20">
            {Math.round(progress)}%
          </span>
        </>
      )}
    </div>
  );
}

export function VideoPlayer({
  url,
  publicId,
  name,
  size,
  isMine,
  hasCaption = false,
  disabled = false,
  uploadProgress = 0,
  isGrid = false, // ডিফল্ট ভ্যালু false
  onExpand,
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const thumbnail = publicId
    ? getVideoThumbnail(url, { width: 280, height: 200, second: 1 })
    : null;

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handlePlay = useCallback(async () => {
    if (disabled) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      try {
        setIsLoading(true);
        await v.play();
        setPlaying(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err?.name !== "AbortError") console.error(err);
      } finally {
        setIsLoading(false);
      }
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [disabled]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (disabled) return;
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current || disabled) return;
    videoRef.current.muted = !muted;
    setMuted((m) => !m);
  };

  // গ্রিডে থাকলে বর্ডার রেডিয়াস প্যারেন্ট কন্টেইনার সামলাবে
  const radius = isGrid
    ? "rounded-none"
    : hasCaption
      ? "rounded-t-2xl"
      : isMine
        ? "rounded-2xl rounded-br-sm"
        : "rounded-2xl rounded-bl-sm";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-black select-none",
        isGrid ? "w-full h-full" : "w-full max-w-[280px]",
        radius,
      )}
      onClick={(e) => {
        // গ্রিডে থাকলে প্লে না করে সরাসরি গ্যালারি (Expand) ওপেন হবে
        if (isGrid && onExpand) {
          e.stopPropagation();
          onExpand();
        } else {
          handlePlay();
        }
      }}
    >
      <video
        ref={videoRef}
        src={url}
        poster={thumbnail ?? undefined}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrent(v.currentTime);
          setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
        }}
        onLoadedMetadata={() => {
          setDuration(videoRef.current?.duration ?? 0);
          setIsLoading(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={() => setPlaying(false)}
        muted={muted}
        playsInline
        preload="none"
        className={cn(
          "w-full object-cover",
          isGrid ? "h-full absolute inset-0" : "h-[180px]",
        )}
        style={isGrid ? undefined : { height: "180px" }}
      />

      {/* Premium Uploading Progress Overlay */}
      {disabled && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center gap-3 cursor-not-allowed z-10 transition-all duration-300">
          <CircularProgress
            progress={uploadProgress}
            done={uploadProgress === 100}
          />
          {uploadProgress !== 100 && !isGrid && (
            <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
              <span className="text-white/90 text-[9px] font-semibold tracking-wider uppercase">
                Uploading
              </span>
            </div>
          )}
        </div>
      )}

      {/* Play overlay */}
      {!disabled && !playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer">
          <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-105 transition-transform pointer-events-none">
            <Play className="h-6 w-6 text-slate-800 ml-1" />
          </div>

          {/* expand btn (গ্রিড মোডে এটি হাইড থাকবে কারণ পুরো ভিডিওটাই ক্লিকেবল) */}
          {!isGrid && onExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              title="Full screen"
            >
              <Maximize2 className="h-3.5 w-3.5 text-white" />
            </button>
          )}

          <div className="absolute bottom-2 left-2 right-2 flex justify-between pointer-events-none">
            {size && (
              <span className="text-[10px] text-white bg-black/50 rounded px-1.5 py-0.5 backdrop-blur-sm">
                {sizeLabel(size)}
              </span>
            )}
            <span className="text-[10px] text-white bg-black/50 rounded px-1.5 py-0.5 ml-auto backdrop-blur-sm">
              {duration > 0 ? fmtTime(duration) : "Video"}
            </span>
          </div>
        </div>
      )}

      {/* Buffering */}
      {!disabled && playing && isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 backdrop-blur-sm">
          <svg
            className="animate-spin h-8 w-8 text-white"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
        </div>
      )}

      {/* Controls (গ্রিড মোডে এটি রেন্ডার হবে না) */}
      {!disabled && playing && !isGrid && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="w-full h-1 bg-white/30 rounded-full cursor-pointer mb-2"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-white rounded-full transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlay();
                }}
                className="text-white hover:text-sky-300 transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </button>
              <button
                onClick={toggleMute}
                className="text-white hover:text-sky-300 transition-colors"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <span className="text-[10px] text-white/90 font-medium tabular-nums tracking-wide">
                {fmtTime(current)} / {fmtTime(duration)}
              </span>
            </div>

            {onExpand && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <Maximize2 className="h-3.5 w-3.5 text-white" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
