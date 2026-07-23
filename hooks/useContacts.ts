/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Contact } from "@/types/chat";
import { useChatStore } from "@/stores/chatStore";
import api from "@/lib/axios";
import { secureDecryptMessage } from "@/helper/E2EHelper";
import { FCPVersion } from "@/core/e2e";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";

const isEncrypted = (text: unknown): boolean => {
  let str = "";
  if (typeof text === "string") str = text;
  else if (text && typeof text === "object") {
    str = (text as any).text || (text as any).content || "";
  }
  return (
    typeof str === "string" &&
    (str.startsWith(`${FCPVersion.V1}:`) || str.startsWith(`${FCPVersion.V4}:`))
  );
};

export const useContacts = (userId: string) => {
  const query = useQuery({
    queryKey: ["contacts", userId],
    networkMode: "offlineFirst",
    queryFn: async () => {
      const { data } = await api.get(`/chats/contacts`);
      if (!data.success) throw new Error("Failed to load contacts");

      // load all contact settings via chatSettingsStore
      useChatSettingsStore.getState().loadAll();

      return data.contacts;
    },
    enabled: !!userId,
    // staleTime: 5 * 60 * 1000, // 5 minutes
    meta: { persist: true },
  });

  useEffect(() => {
    if (!query.data) return;
    const processAndDecryptContacts = async () => {
      const { socket } = useChatStore.getState();

      const decryptedContacts = await Promise.all(
        query.data.map(async (c: any) => {
          if (!c.lastMessage || typeof c.lastMessage.content !== "string") {
            return c;
          }
          if (c.isGroupChat) return c;
          const content = c.lastMessage.content;
          if (!isEncrypted(content)) return c;

          if (!c.publicKey || !c.customChatId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                content: "🔒 [Encrypted Message]",
              },
            };
          }

          try {
            const decrypted = await secureDecryptMessage(
              content,
              c.customChatId,
              c.publicKey,
            );

            const decryptedText =
              typeof decrypted === "string"
                ? decrypted
                : decrypted?.text || "🔒 [Encrypted Message]";

            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                content: decryptedText,
              },
            };
          } catch (error) {
            console.error(`Decryption failed for ${c.name}:`, error);
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                content: "🔒 [Encrypted Message]",
              },
            };
          }
        }),
      );

      useChatStore.setState({ contacts: decryptedContacts });
      decryptedContacts.forEach((c: Contact) => {
        socket?.emit(
          "check_status",
          c.id,
          ({ online }: { online: boolean }) => {
            useChatStore.setState((s) => ({
              contacts: s.contacts.map((x) =>
                x.id === c.id ? { ...x, isOnline: online } : x,
              ),
            }));
          },
        );
      });
    };

    processAndDecryptContacts();
  }, [query.data]);

  return query;
};
