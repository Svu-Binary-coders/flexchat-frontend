import { create } from "zustand";
import { persist } from "zustand/middleware";

type FontStyle = "font-sans" | "font-serif";
type TextSize = "14px" | "16px" | "18px" | "20px";
type BubbleStyle = "modern" | "classic" | "minimal";
type Wallpaper =
  | "none"
  | "dots"
  | "grid"
  | "gradient1"
  | "gradient2"
  | "gradient3";

type timeFormat = "12h" | "24h";

interface AppearanceState {
  fontStyle: FontStyle; 
  textSize: TextSize;
  bubbleStyle: BubbleStyle;
  wallpaper: Wallpaper;
  compactMode: boolean;
  timeFormat: timeFormat;

  setFontStyle: (v: FontStyle) => void;
  setTextSize: (v: TextSize) => void;
  setBubbleStyle: (v: BubbleStyle) => void;
  setWallpaper: (v: Wallpaper) => void;
  setCompactMode: (v: boolean) => void;
  setTimeFormat: (v: timeFormat) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      fontStyle: "font-sans",
      textSize: "14px",
      bubbleStyle: "modern",
      wallpaper: "none",
      compactMode: false,
      timeFormat: "12h",
      setFontStyle: (v) => set({ fontStyle: v }),
      setTextSize: (v) => set({ textSize: v }),
      setBubbleStyle: (v) => set({ bubbleStyle: v }),
      setWallpaper: (v) => set({ wallpaper: v }),
      setCompactMode: (v) => set({ compactMode: v }),
      setTimeFormat: (v) => set({ timeFormat: v }),
    }),
    { name: "appearance-settings" },
  ),
);
