"use client";
import React from "react";
import { Merriweather } from "next/font/google";
import ChatLayout from "@/components/chat/ChatLayout";
import { useAppearanceStore } from "@/stores/appearanceStore";

const fontSerif = Merriweather({ weight: ["400", "700"], subsets: ["latin"] });

export default function ChatPage() {
  const { fontStyle, textSize, compactMode } = useAppearanceStore();

  const activeFontClass =
    fontStyle === "font-serif" ? fontSerif.className : "font-sans";

  const sizeMap = {
    "14px": "text-sm",
    "16px": "text-base",
    "18px": "text-lg",
    "20px": "text-xl",
  };
  const activeSizeClass = sizeMap[textSize as keyof typeof sizeMap];

  const compactClass = compactMode ? "p-2 gap-2" : "p-4 gap-4";

  return (
    <div
      className={`flex flex-col h-screen bg-white ${activeFontClass} ${activeSizeClass} ${compactClass}`}
    >
      <ChatLayout />
    </div>
  );
}
