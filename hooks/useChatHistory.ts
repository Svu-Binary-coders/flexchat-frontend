/* eslint-disable @typescript-eslint/no-explicit-any */
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Message, MessageStatus } from "@/types/chat";
import { useChatStore } from "@/stores/chatStore";
import api from "@/lib/axios";
import { saveChatOffline, getChatOffline } from "@/app/indexDB/messageDB";
import { secureDecryptMessage } from "@/helper/E2EHelper";
import {
  decryptGroupMessage,
  isGroupEncrypted,
  loadGroupSenderKeys,
} from "@/helper/groupE2EHelper";

interface RawMessage {
  _id: string;
  senderId: string;
  messageStatus: MessageStatus;
  content: string;
  replyTo?: { _id: string; content: string; senderId: string } | null;
  [key: string]: unknown;
}

interface PageResult {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
}

const deduplicateMessages = (messages: Message[]): Message[] => {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (!m._id || seen.has(m._id)) return false;
    seen.add(m._id);
    return true;
  });
};

const sortByTime = (messages: Message[]) =>
  messages.sort(
    (a: any, b: any) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime(),
  );

const isEncrypted = (text: unknown): boolean => {
  let str = "";
  if (typeof text === "string") str = text;
  else if (text && typeof text === "object")
    str = (text as any).text || (text as any).content || "";
  return (
    typeof str === "string" && (str.startsWith("v1:") || str.startsWith("v4:"))
  );
};

const safeDecrypt = async (content: any, chatId: string, publicKey: string) => {
  if (content && typeof content === "object" && "flags" in content) {
    return {
      text:
        typeof content.text === "string"
          ? content.text
          : "🔒 [Decryption Error]",
      flags: content.flags,
      conditions: content.conditions || "NONE",
    };
  }
  let strContent = "";
  if (typeof content === "string") strContent = content;
  else if (content && typeof content === "object")
    strContent = content.text || content.content || "";
  if (!isEncrypted(strContent)) {
    return {
      text: strContent,
      flags: { isViewOnce: false, isDecoy: false, isHighlyForwarded: false },
      conditions: "NONE",
    };
  }
  try {
    return await secureDecryptMessage(strContent, chatId, publicKey);
  } catch {
    return {
      text: "🔒 [Encrypted Message]",
      flags: { isViewOnce: false, isDecoy: false, isHighlyForwarded: false },
      conditions: "NONE",
    };
  }
};

const safeDecryptReplyTo = async (
  replyTo: RawMessage["replyTo"] | undefined | null,
  chatId: string,
  publicKey: string,
): Promise<Message["replyTo"]> => {
  if (!replyTo) return null;
  if (!isEncrypted(replyTo.content)) return replyTo as Message["replyTo"];
  const decryptedObj = await safeDecrypt(replyTo.content, chatId, publicKey);
  return { ...replyTo, content: decryptedObj.text } as Message["replyTo"];
};

// ✅ group message decrypt — no counter, random IV handles uniqueness
const safeDecryptGroup = async (
  content: string,
  chatId: string,
): Promise<string> => {
  if (!isGroupEncrypted(content)) return content;
  try {
    return await decryptGroupMessage(content, chatId);
  } catch (err) {
    console.error(
      "[GroupE2E] decryptGroupMessage failed:",
      err,
      "| content:",
      content.slice(0, 60),
    );
    return "🔒 [Encrypted Message]";
  }
};

const safeDecryptGroupReplyTo = async (
  replyTo: RawMessage["replyTo"] | undefined | null,
  chatId: string,
): Promise<Message["replyTo"]> => {
  if (!replyTo) return null;
  if (!isGroupEncrypted(replyTo.content)) return replyTo as Message["replyTo"];
  const decrypted = await safeDecryptGroup(replyTo.content, chatId);
  return { ...replyTo, content: decrypted } as Message["replyTo"];
};

// ==========================================
export const useChatHistory = (
  myId: string,
  chatId?: string,
  contactId?: string,
) => {
  const socketMsgIdsRef = useRef<Set<string>>(new Set());
  const apiLoadedRef = useRef(false);
  const prevChatIdRef = useRef<string | undefined>(chatId);

  useEffect(() => {
    if (prevChatIdRef.current === chatId) return;
    prevChatIdRef.current = chatId;
    socketMsgIdsRef.current = new Set();
    apiLoadedRef.current = false;
  }, [chatId]);

  const query = useInfiniteQuery<PageResult>({
    queryKey: ["messages", chatId],
    networkMode: "offlineFirst",

    queryFn: async ({ pageParam }) => {
      const contact = useChatStore
        .getState()
        .contacts.find((c) => c._id === contactId || c.customChatId === chatId);

      const peerPublicKey = contact?.publicKey;
      const isGroup = contact?.isGroupChat ?? false;

      // ✅ group — first load এ participants থেকে sender keys load
      if (isGroup && chatId && !pageParam) {
        const members = (contact?.participants ?? []).filter(
          (p: any) => p.publicKey,
        );
        console.log(
          "[GroupE2E] participants found:",
          members.length,
          members.map((p: any) => ({
            id: (p._id ?? p.userId)?.toString(),
            hasKey: !!p.publicKey,
          })),
        );

        if (members.length > 0) {
          const senderPublicKeys = new Map<string, string>(
            members.map((p: any) => [
              (p._id ?? p.userId)?.toString(),
              p.publicKey,
            ]),
          );
          console.log("[GroupE2E] loading sender keys for:", [
            ...senderPublicKeys.keys(),
          ]);
          await loadGroupSenderKeys(chatId, senderPublicKeys).catch((err) => {
            console.error("[GroupE2E] loadGroupSenderKeys failed:", err);
          });
          console.log("[GroupE2E] sender keys load done");
        } else {
          console.warn(
            "[GroupE2E] no participants with publicKey — cannot load sender keys",
          );
        }
      }

      // IndexDB offline load
      if (!pageParam) {
        getChatOffline(chatId ?? "")
          .then(async (offlineMessages) => {
            if (!offlineMessages?.length) return;

            // ✅ sequential — group decrypt order matters
            const decrypted: any[] = [];
            for (const m of offlineMessages.slice(-50)) {
              const raw =
                typeof m.content === "string"
                  ? m.content
                  : m.content?.text || m.content?.content || "";

              let text = raw;
              let replyTo = m.replyTo ?? null;

              if (isGroup && chatId) {
                text = await safeDecryptGroup(raw, chatId);
                replyTo = await safeDecryptGroupReplyTo(m.replyTo, chatId);
              } else if (peerPublicKey && chatId) {
                const dec = await safeDecrypt(raw, chatId, peerPublicKey);
                text = dec.text;
                replyTo = await safeDecryptReplyTo(
                  m.replyTo,
                  chatId,
                  peerPublicKey,
                );
              }

              decrypted.push({
                ...m,
                content: text,
                isBurn: false,
                conditions: "NONE",
                encryptedContent: raw,
                replyTo,
                _isOffline: true,
              });
            }

            if (!apiLoadedRef.current) {
              const cur = useChatStore.getState().messages;
              useChatStore.setState({
                messages: sortByTime(
                  deduplicateMessages([...decrypted, ...cur]),
                ),
              });
            }
          })
          .catch(() => {});
      }

      // API fetch
      const cursor = pageParam ? `&before=${pageParam}` : "";
      const { data } = await api(
        `/chats/${myId}/${chatId}/${contactId}/?limit=20${cursor}`,
      );
      if (!data.success) throw new Error("Failed to load messages from server");

      // ✅ sequential for group — parallel ok for 1-1
      const messages: Message[] = [];

      if (isGroup && chatId) {
        for (const m of data.messages) {
          const raw = m.content;
          console.log(
            `[GroupE2E] decrypting msg ${m._id} | content: ${raw.slice(0, 40)}...`,
          );
          const text = await safeDecryptGroup(raw, chatId);
          console.log(`[GroupE2E] result: ${text.slice(0, 40)}`);
          const replyTo = await safeDecryptGroupReplyTo(m.replyTo, chatId);

          messages.push({
            ...m,
            content: text,
            isBurn: false,
            conditions: "NONE",
            encryptedContent: raw,
            replyTo,
            status:
              m.senderId === myId
                ? (m.messageStatus as MessageStatus)
                : undefined,
          } as Message & { encryptedContent?: string });
        }
      } else {
        // 1-1 — parallel fine
        const results = await Promise.all(
          data.messages.map(async (m: RawMessage) => {
            const raw = m.content;
            let text = raw;
            let isBurn = false;
            let conditions = "NONE";
            let replyTo: Message["replyTo"] = null;

            if (peerPublicKey && chatId) {
              const dec = await safeDecrypt(m.content, chatId, peerPublicKey);
              text = dec.text;
              isBurn = dec.flags?.isViewOnce || false;
              conditions = dec.conditions || "NONE";
              replyTo = await safeDecryptReplyTo(
                m.replyTo,
                chatId,
                peerPublicKey,
              );
            }

            return {
              ...m,
              content: text,
              isBurn,
              conditions,
              encryptedContent: raw,
              replyTo,
              status:
                m.senderId === myId
                  ? (m.messageStatus as MessageStatus)
                  : undefined,
            } as Message & { encryptedContent?: string };
          }),
        );
        messages.push(...results);
      }

      if (!pageParam) apiLoadedRef.current = true;

      return {
        messages,
        hasMore: data.pagination.hasMore,
        nextCursor: data.pagination.nextCursor ?? null,
      };
    },

    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore || !lastPage.nextCursor) return undefined;
      const prevCursor = allPages[allPages.length - 2]?.nextCursor;
      if (lastPage.nextCursor === prevCursor) return undefined;
      return lastPage.nextCursor;
    },

    enabled: !!chatId && !!contactId && !!myId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Merge effect
  useEffect(() => {
    if (!query.data) return;
    if (useChatStore.getState().activeContact?.customChatId !== chatId) return;

    const allQueryMsgs = [...query.data.pages].flatMap((p) => p.messages);
    const queryIds = new Set(allQueryMsgs.map((m) => m._id));
    const currentStore = useChatStore.getState().messages;

    const nonQueryMsgs = currentStore.filter((m) => {
      if (!m._id) return false;
      if (queryIds.has(m._id)) return false;
      if ((m as any)._isOffline) return false;
      return true;
    });

    nonQueryMsgs.forEach((m) => {
      if (!(m as any).isTemp) socketMsgIdsRef.current.add(m._id!);
    });

    const final = sortByTime(
      deduplicateMessages([...allQueryMsgs, ...nonQueryMsgs]),
    );

    useChatStore.setState({ messages: final });

    if (final.length > 0) {
      saveChatOffline(
        chatId ?? "",
        final.slice(-100).map((m: any) => ({
          ...m,
          content:
            typeof m.encryptedContent === "string"
              ? m.encryptedContent
              : typeof m.content === "string"
                ? m.content
                : "",
          replyTo: m.replyTo
            ? {
                ...m.replyTo,
                content:
                  typeof m.replyTo.content === "string"
                    ? m.replyTo.content
                    : typeof m.replyTo.encryptedContent === "string"
                      ? m.replyTo.encryptedContent
                      : "",
              }
            : null,
        })),
      );
    }
  }, [query.data, chatId]);

  return query;
};
