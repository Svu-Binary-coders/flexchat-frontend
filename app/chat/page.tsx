import React from "react";
import ChatPage from "./_mainChat";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "FlexChat - End to End Encrypted Chat App",
  description:
    "Chat with your contacts securely and privately using FlexChat's end-to-end encrypted messaging platform. Experience seamless communication while keeping your conversations safe from prying eyes.",
    robots: "noindex, nofollow",
};

export default function page() {
  return (
    <div>
      <ChatPage />
    </div>
  );
}
