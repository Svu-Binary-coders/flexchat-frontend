/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import io from "socket.io-client";
type Socket = ReturnType<typeof io>;
import {
  Message,
  Contact,
  MessageStatus,
  ContextMenuState,
} from "@/types/chat";
import { SOCKET_URL } from "@/lib/chat-helpers";
import { getQueryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/axios";
import { secureDecryptMessage, secureEncryptMessage } from "@/helper/E2EHelper";
import { ChatSettings, useChatSettingsStore } from "./chatSettingsStore";
import {
  encryptGroupMessage,
  decryptGroupMessage,
  isGroupEncrypted,
  loadGroupSenderKeys,
  rotateGroupSenderKey,
  ensureGroupSenderKey,
} from "@/helper/groupE2EHelper";

const isEncrypted = (text: unknown): boolean =>
  typeof text === "string" &&
  (text.startsWith("v1:") || text.startsWith("v4:"));

const safeDecrypt = async (
  content: string,
  chatId: string,
  publicKey: string,
): Promise<string> => {
  if (!isEncrypted(content)) return content;
  try {
    const decrypted = await secureDecryptMessage(content, chatId, publicKey);
    return typeof decrypted === "string" ? decrypted : decrypted.text;
  } catch {
    return " [Encrypted Message]";
  }
};

const safeDecryptReplyTo = async (
  replyTo: Message["replyTo"],
  chatId: string,
  publicKey: string,
): Promise<Message["replyTo"]> => {
  if (!replyTo?.content) return replyTo;
  if (!isEncrypted(replyTo.content)) return replyTo;
  const decryptedContent = await safeDecrypt(
    replyTo.content,
    chatId,
    publicKey,
  );
  return { ...replyTo, content: decryptedContent };
};

const getAttachmentPreview = (msg: any): string => {
  if (msg.content && typeof msg.content === "string" && msg.content.trim()) {
    return msg.content;
  }
  const atts: any[] = msg.attachments ?? [];
  if (atts.some((a: any) => a.type === "VoiceMessage"))
    return "🎤 Voice message";
  if (atts.some((a: any) => a.type === "image")) return "📷 Photo";
  if (atts.some((a: any) => a.type === "video")) return "🎥 Video";
  if (atts.some((a: any) => a.type === "audio")) return "🎵 Audio";
  if (atts.some((a: any) => a.type === "file")) return "📎 File";
  return "";
};

// ==========================================
// CACHE TYPES
// ==========================================
interface InfinitePage {
  messages: Message[];
  hasMore: boolean;
  oldestId: string | null;
}

interface InfiniteCache {
  pages: InfinitePage[];
  pageParams: unknown[];
}

const dedupe = (messages: Message[]): Message[] => {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (!m._id || seen.has(m._id)) return false;
    seen.add(m._id);
    return true;
  });
};

const updateMessagesCache = (
  chatId: string | undefined,
  updater: (old: Message[]) => Message[],
) => {
  if (!chatId) return;
  getQueryClient().setQueryData(
    ["messages", chatId],
    (old: InfiniteCache | undefined) => {
      if (!old?.pages?.length) return old;
      const lastIdx = old.pages.length - 1;
      const updatedMessages = dedupe(updater(old.pages[lastIdx].messages));
      return {
        ...old,
        pages: old.pages.map((page, i) =>
          i === lastIdx ? { ...page, messages: updatedMessages } : page,
        ),
      };
    },
  );
};

const updateAllPagesCache = (
  chatId: string | undefined,
  updater: (msg: Message) => Message,
) => {
  if (!chatId) return;
  getQueryClient().setQueryData(
    ["messages", chatId],
    (old: InfiniteCache | undefined) => {
      if (!old?.pages?.length) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: page.messages.map(updater),
        })),
      };
    },
  );
};

const filterAllPagesCache = (
  chatId: string | undefined,
  predicate: (msg: Message) => boolean,
) => {
  if (!chatId) return;
  getQueryClient().setQueryData(
    ["messages", chatId],
    (old: InfiniteCache | undefined) => {
      if (!old?.pages?.length) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: page.messages.filter(predicate),
        })),
      };
    },
  );
};

interface NewChatPreview {
  user_id: string;
  name: string;
  profile_image?: string;
  id: string;
}

type ActiveView =
  | "chats"
  | "calls"
  | "invite"
  | "settings"
  | "chat-lock"
  | "archive"
  | "media";

interface ChatStore {
  activeView: ActiveView;
  isConnected: boolean;
  contacts: Contact[];
  visibleContacts: () => Contact[];
  activeContact: Contact | null;
  messages: Message[];
  msgInput: string;
  isTyping: boolean;
  showNewChat: boolean;
  newChatId: string;
  newChatLoading: boolean;
  newChatError: string;
  newChatPreview: NewChatPreview[];
  contextMenu: ContextMenuState | null;
  editingMsg: Message | null;
  reaction: Message | null;
  replyTo: Message | null;
  forwardMsg: Message | null;
  socket: Socket | null;
  showEmojiPicker: boolean;
  _typingTimeout: ReturnType<typeof setTimeout> | undefined;
  _previewTimeout: ReturnType<typeof setTimeout> | undefined;
  togglePin: (chatId: string) => Promise<void>;
  toggleFavorite: (chatId: string) => Promise<void>;
  setMsgInput: (v: string) => void;
  setShowNewChat: (v: boolean) => void;
  setContextMenu: (v: ContextMenuState | null) => void;
  setForwardMsg: (v: Message | null) => void;
  handeleAddReaction: (msg: Message, reaction: string) => void;
  setActiveView: (view: ActiveView) => void;
  setShowEmojiPicker: (v: boolean) => void;
  addOptimisticMessage: (msg: any) => void;
  replaceTempMessage: (tempId: string, realMsg: any) => void;
  removeTempMessage: (tempId: string) => void;
  initSocket: () => () => void;
  openChat: (contact: Contact | null) => void;
  sendMessage: () => void;
  handleTyping: (value: string) => void;
  handleAction: (action: string, msg: Message) => void;
  handleForward: (contactId: string) => void;
  handleNewChatIdChange: (val: string) => void;
  createAndOpenChat: (selectedUser: NewChatPreview) => Promise<void>;
  closeNewChat: () => void;
  openCtx: (e: React.MouseEvent, msg: Message, isMine: boolean) => void;
}

const getChatSettings = (chatId: string): ChatSettings => {
  return useChatSettingsStore.getState().getSettings(chatId);
};

// ==========================================
// STORE
// ==========================================
export const useChatStore = create<ChatStore>()((set, get) => ({
  activeView: "chats" as ActiveView,
  isConnected: false,
  contacts: [],
  visibleContacts: () => get().contacts.filter((c) => c.isChatLock !== true),
  activeContact: null,
  showEmojiPicker: false,
  messages: [],
  msgInput: "",
  isTyping: false,
  showNewChat: false,
  newChatId: "",
  newChatLoading: false,
  newChatError: "",
  newChatPreview: [],
  contextMenu: null,
  editingMsg: null,
  replyTo: null,
  forwardMsg: null,
  socket: null,
  _typingTimeout: undefined,
  _previewTimeout: undefined,
  reaction: null,
  setMsgInput: (v) => set({ msgInput: v }),
  setShowNewChat: (v) => set({ showNewChat: v }),
  setContextMenu: (v) => set({ contextMenu: v }),
  setForwardMsg: (v) => set({ forwardMsg: v }),
  setActiveView: (view: ActiveView) => set({ activeView: view }),
  setShowEmojiPicker: (v: boolean) => set({ showEmojiPicker: v }),

  toggleChatLock: (customChatId: string) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.customChatId === customChatId
          ? { ...c, isChatLock: !c.isChatLock }
          : c,
      ),
    })),

  togglePin: async (chatId) => {
    try {
      await api.post(`/chats/toggle-pin/${chatId}`);
      set((s) => ({
        contacts: s.contacts.map((c) =>
          c.customChatId === chatId ? { ...c, isPinned: !c.isPinned } : c,
        ),
      }));
    } catch (error) {
      console.error("Toggle pin failed", error);
    }
  },

  toggleFavorite: async (chatId) => {
    try {
      await api.post(`/chats/toggle-favorite/${chatId}`);
      set((s) => ({
        contacts: s.contacts.map((c) =>
          c.customChatId === chatId ? { ...c, isFavorite: !c.isFavorite } : c,
        ),
      }));
    } catch (error) {
      console.error("Toggle favorite failed", error);
    }
  },

  addOptimisticMessage: (msg) => {
    const chatId = get().activeContact?.customChatId;
    const myId = useAuthStore.getState().myId;
    const { activeContact } = get();
    const tempMsg = { ...msg, senderId: myId, status: MessageStatus.SENDING };

    set((s) => ({
      messages: [...s.messages, tempMsg],
      contacts: s.contacts
        .map((c) =>
          c.id === activeContact?.id
            ? {
                ...c,
                lastMessage: {
                  content: getAttachmentPreview(tempMsg) || "Sending…",
                  createdAt: tempMsg.createdAt || new Date().toISOString(),
                },
              }
            : c,
        )
        .sort(
          (a, b) =>
            new Date(b.lastMessage?.createdAt || 0).getTime() -
            new Date(a.lastMessage?.createdAt || 0).getTime(),
        ),
    }));
    updateMessagesCache(chatId, (old) => [...old, tempMsg]);
  },

  replaceTempMessage: (tempId, realData) => {
    const chatId = get().activeContact?.customChatId;
    const myId = useAuthStore.getState().myId;
    const { activeContact } = get();

    const realMsg = {
      _id: realData.messageId,
      senderId: myId,
      content: realData.text ?? "",
      attachments: realData.attachments ?? [],
      createdAt: new Date().toISOString(),
      status: MessageStatus.SENT,
      isTemp: false,
    };

    set((s) => ({
      messages: s.messages.map((m) => (m._id === tempId ? realMsg : m)),
    }));
    updateMessagesCache(chatId, (old) =>
      old.map((m) => (m._id === tempId ? realMsg : m)),
    );
    set((s) => ({
      contacts: s.contacts
        .map((c) =>
          c.id === activeContact?.id
            ? {
                ...c,
                lastMessage: {
                  content: getAttachmentPreview(realMsg),
                  createdAt: realMsg.createdAt,
                },
              }
            : c,
        )
        .sort(
          (a, b) =>
            new Date(b.lastMessage?.createdAt || 0).getTime() -
            new Date(a.lastMessage?.createdAt || 0).getTime(),
        ),
    }));
  },

  removeTempMessage: (tempId) => {
    const chatId = get().activeContact?.customChatId;
    set((s) => ({ messages: s.messages.filter((m) => m._id !== tempId) }));
    filterAllPagesCache(chatId, (m) => m._id !== tempId);
  },

  // ==========================================
  // SOCKET
  // ==========================================
  initSocket: () => {
    const existing = get().socket;
    if (existing) {
      existing.disconnect();
      existing.removeAllListeners();
    }

    const myId = useAuthStore.getState().myId;
    const { activeContact } = get();
    const socket = io(SOCKET_URL, {
      reconnection: true,
      timeout: 10000, // 10 seconds when trying to connect
      reconnectionDelay: 1000, // 1 second to reconnect
      reconnectionAttempts: 5, // Try to reconnect 5 times
      query: { userId: myId },
      withCredentials: true,
    });
    socket.on("connect_error", (err) => {
      console.error(" Socket Connection Error:", err.message);
    });

    if (myId) socket.emit("setup", myId);
    if (activeContact?.customChatId) {
      socket.emit("join_chat", activeContact.customChatId);
    }

    set({ socket });

    // ==========================================
    // 1-1 RECEIVE — existing same
    // ==========================================
    socket.on("receive_private_message", async (data: any) => {
      const { activeContact, contacts } = get();

      const targetContact = contacts.find(
        (c) => c.customChatId === data.chatId || c.id === data.chatId,
      );

      const isGroup = !!data.isGroupChat || targetContact?.isGroupChat;
      const targetChatId = targetContact?.customChatId ?? data.chatId;

      if (isGroup) {
        if (isGroupEncrypted(data.content)) {
          try {
            data.content = await decryptGroupMessage(
              data.content,
              targetChatId,
            );
          } catch {
            data.content = "🔒 [Encrypted Message]";
          }
        }

        if (targetChatId === activeContact?.customChatId) {
          set((s) => {
            const exists = s.messages.some((m) => m._id === data._id);
            if (exists) return s;
            return {
              messages: [
                ...s.messages,
                { ...data, status: MessageStatus.READ },
              ],
              contacts: s.contacts.map((c) =>
                c.customChatId === targetChatId
                  ? {
                      ...c,
                      unreadCount: 0,
                      lastMessage: {
                        content: data.content,
                        createdAt: data.createdAt || new Date().toISOString(),
                      },
                    }
                  : c,
              ),
            };
          });
          updateMessagesCache(targetChatId, (old) => {
            const exists = old.some((m) => m._id === data._id);
            if (exists) return old;
            return [...old, { ...data, status: MessageStatus.READ }];
          });
        } else {
          set((s) => ({
            contacts: s.contacts
              .map((c) =>
                c.customChatId === targetChatId
                  ? {
                      ...c,
                      unreadCount: (c.unreadCount || 0) + 1,
                      lastMessage: {
                        content: data.content,
                        createdAt: data.createdAt || new Date().toISOString(),
                      },
                    }
                  : c,
              )
              .sort(
                (a, b) =>
                  new Date(b.lastMessage?.createdAt || 0).getTime() -
                  new Date(a.lastMessage?.createdAt || 0).getTime(),
              ),
          }));
        }
        return;
      }

      const sender = contacts.find((c) => c.id === data.senderId);

      if (sender?.publicKey && sender?.customChatId) {
        data.content = await safeDecrypt(
          data.content,
          sender.customChatId,
          sender.publicKey,
        );
        if (data.replyTo) {
          data.replyTo = await safeDecryptReplyTo(
            data.replyTo,
            sender.customChatId,
            sender.publicKey,
          );
        }
      } else {
        data.content = "🔒 [Encrypted Message]";
      }

      if (data.senderId === activeContact?.id) {
        const newMsg = { ...data, status: MessageStatus.READ };
        set((s) => {
          const exists = s.messages.some((m) => m._id === data._id);
          if (exists) return s;
          return {
            messages: [...s.messages, newMsg],
            contacts: s.contacts.map((c) =>
              c.id === data.senderId
                ? {
                    ...c,
                    unreadCount: 0,
                    lastMessage: {
                      content: data.content,
                      createdAt: data.createdAt || new Date().toISOString(),
                    },
                  }
                : c,
            ),
          };
        });
        updateMessagesCache(activeContact!.customChatId, (old) => {
          const exists = old.some((m) => m._id === data._id);
          if (exists) return old;
          return [...old, newMsg];
        });
        socket.emit("message_read", {
          chatRoomId: activeContact!.customChatId,
          senderId: data.senderId,
        });
      } else {
        set((s) => ({
          contacts: s.contacts
            .map((c) =>
              c.id === data.senderId
                ? {
                    ...c,
                    unreadCount: (c.unreadCount || 0) + 1,
                    lastMessage: {
                      content: data.content,
                      createdAt: data.createdAt || new Date().toISOString(),
                    },
                  }
                : c,
            )
            .sort(
              (a, b) =>
                new Date(b.lastMessage?.createdAt || 0).getTime() -
                new Date(a.lastMessage?.createdAt || 0).getTime(),
            ),
        }));
        socket.emit("message_delivered", {
          chatRoomId: sender?.customChatId,
          senderId: data.senderId,
        });
      }
    });

    // ✅ Key rotation — member add/remove হলে
    socket.on(
      "group:key_rotation_needed",
      async ({ chatId }: { chatId: string }) => {
        const myId = useAuthStore.getState().myId;
        if (!myId) return;
        try {
          const { data } = await api.get(
            `/groups/${chatId}/members-public-keys`,
          );
          await rotateGroupSenderKey(chatId, myId, data.members);
        } catch (err) {
          console.error("Key rotation failed:", err);
        }
      },
    );

    // ✅ New member join হলে — তার sender key load করো
    socket.on(
      "group:member_joined",
      async ({
        chatId,
        memberPublicKeys,
      }: {
        chatId: string;
        memberPublicKeys: Map<string, string>;
      }) => {
        const { activeContact } = get();
        if (activeContact?.customChatId === chatId) {
          await loadGroupSenderKeys(chatId, memberPublicKeys);
        }
      },
    );

    // STATUS ACKS — existing same
    socket.on("message_delivered_ack", () => {
      const chatId = get().activeContact?.customChatId;
      set((s) => ({
        messages: s.messages.map((m) =>
          m.status === MessageStatus.SENT || m.status === MessageStatus.SENDING
            ? { ...m, status: MessageStatus.DELIVERED }
            : m,
        ),
      }));
      updateAllPagesCache(chatId, (m) =>
        m.status === MessageStatus.SENT || m.status === MessageStatus.SENDING
          ? { ...m, status: MessageStatus.DELIVERED }
          : m,
      );
    });

    socket.on("message_read_ack", () => {
      const chatId = get().activeContact?.customChatId;
      set((s) => ({
        messages: s.messages.map((m) =>
          m.status === MessageStatus.DELIVERED ||
          m.status === MessageStatus.SENT
            ? { ...m, status: MessageStatus.READ }
            : m,
        ),
      }));
      updateAllPagesCache(chatId, (m) =>
        m.status === MessageStatus.DELIVERED || m.status === MessageStatus.SENT
          ? { ...m, status: MessageStatus.READ }
          : m,
      );
    });

    socket.on("mark_all_read_ack", ({ chatRoomId }: { chatRoomId: string }) => {
      const { activeContact } = get();
      if (activeContact?.customChatId === chatRoomId) {
        set((s) => ({
          messages: s.messages.map((m) => ({
            ...m,
            status: MessageStatus.READ,
          })),
        }));
        updateAllPagesCache(chatRoomId, (m) => ({
          ...m,
          status: MessageStatus.READ,
        }));
      }
    });

    socket.on(
      "message_edited_ack",
      async ({
        messageId,
        newContent,
      }: {
        messageId: string;
        newContent: string;
      }) => {
        const { activeContact } = get();
        const chatId = activeContact?.customChatId;
        let decryptedContent = newContent;

        //  group edit decrypt
        if (activeContact?.isGroupChat && isGroupEncrypted(newContent)) {
          try {
            decryptedContent = await decryptGroupMessage(newContent, chatId!);
          } catch {
            decryptedContent = "🔒 [Encrypted Message]";
          }
        } else if (activeContact?.publicKey && chatId) {
          decryptedContent = await safeDecrypt(
            newContent,
            chatId,
            activeContact.publicKey,
          );
        }

        set((s) => ({
          messages: s.messages.map((m) =>
            m._id === messageId
              ? { ...m, content: decryptedContent, is_edited: true }
              : m,
          ),
        }));
        updateAllPagesCache(chatId, (m) =>
          m._id === messageId
            ? { ...m, content: decryptedContent, is_edited: true }
            : m,
        );
      },
    );

    socket.on(
      "message_deleted_ack",
      ({
        messageId,
        deleteForEveryone,
      }: {
        messageId: string;
        deleteForEveryone: boolean;
      }) => {
        const chatId = get().activeContact?.customChatId;
        if (deleteForEveryone) {
          set((s) => ({
            messages: s.messages.map((m) =>
              m._id === messageId
                ? {
                    ...m,
                    content: "This message was deleted",
                    is_deleted_for_everyone: true,
                  }
                : m,
            ),
          }));
          updateAllPagesCache(chatId, (m) =>
            m._id === messageId
              ? {
                  ...m,
                  content: "This message was deleted",
                  is_deleted_for_everyone: true,
                }
              : m,
          );
        } else {
          set((s) => ({
            messages: s.messages.filter((m) => m._id !== messageId),
          }));
          filterAllPagesCache(chatId, (m) => m._id !== messageId);
        }
      },
    );

    socket.on(
      "reaction_added_ack",
      ({
        messageId,
        reaction,
        senderId,
      }: {
        messageId: string;
        reaction: string;
        senderId: string;
      }) => {
        const chatId = get().activeContact?.customChatId;

        const applyReceivedReaction = (currentMsg: Message) => {
          const currentReactions = Array.isArray(currentMsg.reactions)
            ? [...currentMsg.reactions]
            : [];

          const existingReactionIndex = currentReactions.findIndex(
            (r: any) =>
              r.userId === senderId ||
              (r.userIds && r.userIds.includes(senderId)),
          );

          let oldReaction = null;
          if (existingReactionIndex >= 0) {
            oldReaction = currentReactions[existingReactionIndex].emoji;
            currentReactions.splice(existingReactionIndex, 1);
          }

          if (oldReaction !== reaction) {
            currentReactions.push({ emoji: reaction, userIds: [senderId] });
          }

          return { ...currentMsg, reactions: currentReactions };
        };

        set((s) => ({
          messages: s.messages.map((m) =>
            m._id === messageId ? applyReceivedReaction(m) : m,
          ),
        }));
        updateAllPagesCache(chatId, (m) =>
          m._id === messageId ? applyReceivedReaction(m) : m,
        );
      },
    );

    socket.on(
      "message_starred_ack",
      ({
        messageId,
        isImportant,
      }: {
        messageId: string;
        isImportant: boolean;
      }) => {
        const chatId = get().activeContact?.customChatId;
        set((s) => ({
          messages: s.messages.map((m) =>
            m._id === messageId ? { ...m, isImportant } : m,
          ),
        }));
        updateAllPagesCache(chatId, (m) =>
          m._id === messageId ? { ...m, isImportant } : m,
        );
      },
    );
    socket.on("last_message_update", async ({ chatId, lastMessage }: any) => {
      const contact = get().contacts.find(
        (c) => c.customChatId === chatId || c.id === chatId,
      );

      let content = lastMessage?.content ?? "";

      if (isGroupEncrypted(content)) {
        // group — decrypt করো
        try {
          content = await decryptGroupMessage(content, chatId);
        } catch {
          content = "🔒 New message";
        }
      } else if (
        isEncrypted(content) &&
        contact?.publicKey &&
        contact?.customChatId
      ) {
        try {
          content = await safeDecrypt(
            content,
            contact.customChatId,
            contact.publicKey,
          );
        } catch {
          content = "🔒 [Encrypted Message]";
        }
      } else {
        // plain text — attachment preview বা as-is
        content = getAttachmentPreview(lastMessage) || content;
      }

      set((s) => ({
        contacts: s.contacts.map((c) =>
          c.customChatId === chatId || c.id === chatId
            ? { ...c, lastMessage: { ...lastMessage, content } }
            : c,
        ),
      }));
    });

    socket.on("user_online", ({ userId }: { userId: string }) => {
      set((s) => ({
        contacts: s.contacts.map((c) =>
          c.id === userId ? { ...c, isOnline: true } : c,
        ),
        activeContact:
          s.activeContact?.id === userId
            ? { ...s.activeContact, isOnline: true }
            : s.activeContact,
      }));
    });

    socket.on("user_offline", ({ userId }: { userId: string }) => {
      set((s) => ({
        contacts: s.contacts.map((c) =>
          c.id === userId ? { ...c, isOnline: false } : c,
        ),
        activeContact:
          s.activeContact?.id === userId
            ? { ...s.activeContact, isOnline: false }
            : s.activeContact,
      }));
    });

    socket.on("show_typing", (data: any) => {
      const { activeContact } = get();
      if (data.senderId === activeContact?.id) set({ isTyping: true });
    });

    socket.on("hide_typing", (data: any) => {
      const { activeContact } = get();
      if (data.senderId === activeContact?.id) set({ isTyping: false });
    });

    return () => socket.disconnect();
  },

  // ==========================================
  // OPEN CHAT
  // ==========================================
  openChat: (contact: Contact | null) => {
    const { socket, activeContact, _typingTimeout } = get();
    if (_typingTimeout) clearTimeout(_typingTimeout);
    set({ isTyping: false });

    if (activeContact?.id) {
      socket?.emit("leave_chat", activeContact.customChatId);
    }

    if (!contact) {
      set({
        activeContact: null,
        messages: [],
        editingMsg: null,
        replyTo: null,
      });
      return;
    }

    if (activeContact?.id === contact.id) return;

    set({
      activeContact: contact,
      isTyping: false,
      messages: [],
      contextMenu: null,
      editingMsg: null,
      replyTo: null,
      contacts: get().contacts.map((c) =>
        c.id === contact.id ? { ...c, unreadCount: 0 } : c,
      ),
    });

    if (contact.customChatId) {
      socket?.emit("join_chat", contact.customChatId);
    }

    if (contact.isGroupChat && contact.customChatId) {
      const myId = useAuthStore.getState().myId;
      const members = (contact.participants ?? []).filter(
        (p: any) => p.publicKey,
      );

      const senderPublicKeys = new Map(
        members.map((p: any) => [p._id?.toString(), p.publicKey]),
      );

      loadGroupSenderKeys(contact.customChatId, senderPublicKeys).catch((err) =>
        console.error("Failed to load group sender keys:", err),
      );

      if (myId) {
        const memberPublicKeys = members.map((p: any) => ({
          userId: p._id?.toString(),
          publicKey: p.publicKey,
        }));

        ensureGroupSenderKey(
          contact.customChatId,
          myId,
          memberPublicKeys,
        ).catch((err) => console.error("Failed to ensure sender key:", err));
      }
    }

    // 1-1 chat mark as read
    if (!contact.isGroupChat) {
      socket?.emit("mark_all_read", {
        chatRoomId: contact.customChatId,
        senderId: contact.id,
      });
    }
  },

  sendMessage: async () => {
    const {
      msgInput,
      activeContact,
      socket,
      editingMsg,
      replyTo,
      forwardMsg,
      _typingTimeout,
    } = get();
    const myId = useAuthStore.getState().myId;

    if (!msgInput.trim() || !activeContact || !myId) return;

    const content = msgInput.trim();
    const chatId = activeContact.customChatId;

    if (!chatId) return;

    set({ msgInput: "" });

    try {
      let encryptedContent: string | null = null;

      if (activeContact.isGroupChat) {
        encryptedContent = await encryptGroupMessage(content, chatId, myId);
      } else {
        const friendPublicKey = activeContact.publicKey;
        if (!friendPublicKey) {
          console.error("Public key missing");
          return;
        }
        encryptedContent = await secureEncryptMessage(
          content,
          chatId,
          friendPublicKey,
          "text",
        );
      }

      if (!encryptedContent) {
        console.error("Encryption failed");
        return;
      }

      // EDIT MODE
      if (editingMsg) {
        socket?.emit(
          "edit_message",
          {
            messageId: editingMsg._id,
            newContent: encryptedContent,
            chatRoomId: chatId,
            senderId: myId,
            is_forwarded: !!forwardMsg,
          },
          (res: any) => {
            if (res?.success) {
              set((s) => ({
                messages: s.messages.map((m) =>
                  m._id === editingMsg._id
                    ? { ...m, content, is_edited: true }
                    : m,
                ),
              }));
              updateAllPagesCache(chatId, (m) =>
                m._id === editingMsg._id
                  ? { ...m, content, is_edited: true }
                  : m,
              );
            }
          },
        );
        set({ editingMsg: null });
        return;
      }

      socket?.emit("stop_typing", { chatRoomId: chatId });
      clearTimeout(_typingTimeout);

      const tempId = `temp_${Date.now()}`;
      const plainReplyTo = replyTo
        ? {
            _id: replyTo._id!,
            content: replyTo.content,
            senderId: replyTo.senderId,
          }
        : null;

      const tempMsg: Message = {
        _id: tempId,
        senderId: myId,
        content,
        createdAt: new Date().toISOString(),
        status: MessageStatus.SENDING,
        replyTo: plainReplyTo,
      };

      set((s) => ({ messages: [...s.messages, tempMsg], replyTo: null }));
      updateMessagesCache(chatId, (old) => [...old, tempMsg]);

      const disappearingDuration =
        getChatSettings(chatId).disappearingTimer ?? undefined;
      console.log(
        "chatId:",
        chatId,
        "disappearingDuration:",
        disappearingDuration,
      );
      socket?.emit(
        "send_message",
        {
          chatRoomId: chatId,
          receiverId: activeContact.isGroupChat ? null : activeContact.id,
          content: encryptedContent,
          replyToMessageId: replyTo?._id,
          userId: myId,
          disappearingDuration,
        },
        (res: any) => {
          if (res?.success) {
            const sentMsg: Message = {
              ...res.data,
              senderId: myId,
              content,
              status: MessageStatus.SENT,
              replyTo: plainReplyTo,
            };
            set((s) => ({
              messages: s.messages.map((m) => (m._id === tempId ? sentMsg : m)),
              contacts: s.contacts
                .map((c) =>
                  c.id === activeContact.id || c.customChatId === chatId
                    ? {
                        ...c,
                        lastMessage: {
                          content,
                          createdAt: new Date().toISOString(),
                        },
                      }
                    : c,
                )
                .sort(
                  (a, b) =>
                    new Date(b.lastMessage?.createdAt || 0).getTime() -
                    new Date(a.lastMessage?.createdAt || 0).getTime(),
                ),
            }));
            updateMessagesCache(chatId, (old) =>
              old.map((m) => (m._id === tempId ? sentMsg : m)),
            );
          } else {
            set((s) => ({
              messages: s.messages.map((m) =>
                m._id === tempId ? { ...m, status: MessageStatus.FAILED } : m,
              ),
            }));
            updateMessagesCache(chatId, (old) =>
              old.map((m) =>
                m._id === tempId ? { ...m, status: MessageStatus.FAILED } : m,
              ),
            );
          }
        },
      );
    } catch (error) {
      console.error("Send failed:", error);
    }
  },

  handleTyping: (value: string) => {
    const { socket, activeContact, _typingTimeout } = get();
    set({ msgInput: value });

    if (!activeContact?.customChatId || !socket) return;
    socket.emit("typing", { chatRoomId: activeContact.customChatId });

    if (_typingTimeout) clearTimeout(_typingTimeout);

    const timeout = setTimeout(() => {
      socket.emit("stop_typing", { chatRoomId: activeContact.customChatId });
    }, 5000);

    set({ _typingTimeout: timeout });
  },

  handleAction: (action: string, msg: Message) => {
    const { socket, activeContact } = get();
    const chatId = activeContact?.customChatId;

    switch (action) {
      case "reply":
        set({ replyTo: msg, editingMsg: null });
        break;
      case "copy":
        navigator.clipboard.writeText(msg.content);
        break;
      case "star":
        socket?.emit(
          "toggle_star",
          { messageId: msg._id, chatRoomId: chatId },
          (res: any) => {
            if (res?.success) {
              set((s) => ({
                messages: s.messages.map((m) =>
                  m._id === msg._id ? { ...m, isImportant: !m.isImportant } : m,
                ),
              }));
              updateAllPagesCache(chatId, (m) =>
                m._id === msg._id ? { ...m, isImportant: !m.isImportant } : m,
              );
            }
          },
        );
        break;
      case "forward":
        set({ forwardMsg: msg });
        break;
      case "edit":
        set({ editingMsg: msg, replyTo: null, msgInput: msg.content });
        break;
      case "delete_me":
        socket?.emit(
          "delete_message",
          { messageId: msg._id, chatRoomId: chatId, deleteForEveryone: false },
          (res: any) => {
            if (res?.success) {
              set((s) => ({
                messages: s.messages.filter((m) => m._id !== msg._id),
              }));
              filterAllPagesCache(chatId, (m) => m._id !== msg._id);
            }
          },
        );
        break;
      case "delete_all":
        socket?.emit(
          "delete_message",
          {
            messageId: msg._id,
            chatRoomId: chatId,
            deleteForEveryone: true,
            senderId: activeContact?.id,
          },
          (res: any) => {
            if (res?.success) {
              set((s) => ({
                messages: s.messages.map((m) =>
                  m._id === msg._id
                    ? {
                        ...m,
                        content: "This message was deleted",
                        is_deleted_for_everyone: true,
                      }
                    : m,
                ),
              }));
              updateAllPagesCache(chatId, (m) =>
                m._id === msg._id
                  ? {
                      ...m,
                      content: "This message was deleted",
                      is_deleted_for_everyone: true,
                    }
                  : m,
              );
            }
          },
        );
        break;
    }
  },

  handleForward: async (contactId: string) => {
    const { forwardMsg, socket, activeContact, contacts } = get();
    const myId = useAuthStore.getState().myId;
    if (!forwardMsg || !myId) return;

    const targetContact = contacts.find((c) => c.id === contactId);
    const chatId = targetContact?.customChatId;
    const content = forwardMsg.content;

    if (!chatId) return;

    let encryptedContent = "";
    if (content?.trim()) {
      if (targetContact?.isGroupChat) {
        encryptedContent = await encryptGroupMessage(content, chatId, myId);
      } else {
        const pubKey = targetContact?.publicKey;
        if (!pubKey) return;
        const encryptedResult = await secureEncryptMessage(
          content,
          chatId,
          pubKey,
          "text",
        );
        if (!encryptedResult) return;
        encryptedContent = encryptedResult;
      }
    }

    const now = new Date().toISOString();
    const attachmentData =
      forwardMsg.attachments && forwardMsg.attachments.length > 0
        ? forwardMsg.attachments.map((item: any) => ({
            url: item.url,
            type: item.type,
            mimeType: item.mimeType,
            name: item.name,
            size: item.size,
            duration: item.duration ?? null,
            provider: item.provider,
            path: item.path,
            publicId: item.publicId ?? null,
          }))
        : undefined;
    socket?.emit(
      "send_message",
      {
        receiverId: targetContact?.isGroupChat ? null : contactId,
        content: encryptedContent || "",
        is_forwarded: true,
        chatRoomId: chatId,
        attachment: attachmentData,
        mediaType: attachmentData?.[0]?.type ?? undefined,
        disappearingDuration:
          getChatSettings(chatId).disappearingTimer ?? undefined,
      },
      (res: any) => {
        if (res?.success) {
          const sentMsg: Message = {
            ...res.data,
            senderId: myId,
            content,
            status: MessageStatus.SENT,
            is_forwarded: true,
            attachments: forwardMsg.attachments ?? [],
          };

          set((s) => ({
            messages:
              activeContact?.customChatId === chatId
                ? [...s.messages, sentMsg]
                : s.messages,
            contacts: s.contacts
              .map((c) =>
                c.customChatId === chatId
                  ? {
                      ...c,
                      lastMessage: {
                        content: getAttachmentPreview(sentMsg) || content,
                        createdAt: now,
                      },
                    }
                  : c,
              )
              .sort(
                (a, b) =>
                  new Date(b.lastMessage?.createdAt || 0).getTime() -
                  new Date(a.lastMessage?.createdAt || 0).getTime(),
              ),
          }));

          updateMessagesCache(chatId, (old) => [...old, sentMsg]);
        }
      },
    );

    set({ forwardMsg: null });
  },

  handeleAddReaction: (msg: Message, reaction: string) => {
    const { socket, activeContact } = get();
    const myId = useAuthStore.getState().myId;
    const chatId = activeContact?.customChatId;

    if (!chatId || !myId) return;

    const toggleReactionLogic = (currentMsg: Message) => {
      const currentReactions = Array.isArray(currentMsg.reactions)
        ? [...currentMsg.reactions]
        : [];

      const existingReactionIndex = currentReactions.findIndex(
        (r: any) =>
          r.userId === myId || (r.userIds && r.userIds.includes(myId)),
      );

      let oldReaction = null;
      if (existingReactionIndex >= 0) {
        const existing = currentReactions[existingReactionIndex] as any;
        oldReaction = existing.reaction || existing.emoji;
        currentReactions.splice(existingReactionIndex, 1);
      }

      if (oldReaction !== reaction) {
        currentReactions.push({ userId: myId, emoji: reaction });
      }

      return { ...currentMsg, reactions: currentReactions };
    };

    set((s) => ({
      messages: s.messages.map((m) =>
        m._id === msg._id ? toggleReactionLogic(m) : m,
      ),
    }));

    updateAllPagesCache(chatId, (m) =>
      m._id === msg._id ? toggleReactionLogic(m) : m,
    );

    socket?.emit(
      "reaction",
      { chatId, messageId: msg._id, reaction },
      (res: any) => {
        if (res?.success === false) console.error(res.message);
      },
    );
  },

  handleNewChatIdChange: (val: string) => {
    const { _previewTimeout } = get();
    const myId = useAuthStore.getState().myId;
    set({ newChatId: val, newChatPreview: [], newChatError: "" });
    clearTimeout(_previewTimeout);
    if (val.trim().length < 2) return;
    if (val.trim() === myId) {
      set({ newChatError: "Cannot chat with yourself" });
      return;
    }
    const t = setTimeout(async () => {
      set({ newChatLoading: true });
      try {
        const res = await api(`/chats/search?q=${val.trim()}`);
        const data = res.data;
        console.log("Search result:", data);
        if (data.success && data.users.length > 0) {
          set({
            newChatPreview: data.users.map((user: any) => ({
              id: user.id,
              name: user.name,
              profile_image: user.profileImage,
              user_id: user.userId,
            })),
          });
        } else {
          set({ newChatError: "User not found" });
        }
      } catch {
        set({ newChatError: "User not found" });
      } finally {
        set({ newChatLoading: false });
      }
    }, 500);
    set({ _previewTimeout: t });
  },

  createAndOpenChat: async (selectedUser: NewChatPreview) => {
    const { socket } = get();
    const myId = useAuthStore.getState().myId;
    if (!selectedUser || !myId) return;
    set({ newChatLoading: true });
    try {
      const { data } = await api.post(`/chats/create`, {
        receiverId: selectedUser.id,
        senderId: myId,
      });
      if (data.success) {
        const nc: Contact = {
          id: selectedUser.id,
          name: selectedUser.name,
          email: "",
          profile_image: selectedUser.profile_image,
          customChatId: data.chat.chatRoomId,
          unreadCount: 0,
          isOnline: false,
          publicKey: data.publicKey,
        };
        set((s) => ({
          contacts: s.contacts.find((c) => c.id === nc.id)
            ? s.contacts
            : [nc, ...s.contacts],
        }));
        socket?.emit(
          "check_status",
          nc.id,
          ({ online }: { online: boolean }) => {
            set((s) => ({
              contacts: s.contacts.map((c) =>
                c.id === nc.id ? { ...c, isOnline: online } : c,
              ),
            }));
          },
        );
        get().closeNewChat();
        get().openChat(nc);
      } else {
        set({ newChatError: data.message || "Chat create failed" });
      }
    } catch {
      set({ newChatError: "Server error" });
    } finally {
      set({ newChatLoading: false });
    }
  },

  closeNewChat: () => {
    const timeoutId = get()._previewTimeout;
    if (
      timeoutId &&
      (typeof timeoutId === "number" ||
        typeof (timeoutId as any).close === "function")
    ) {
      clearTimeout(timeoutId as any);
    }
    set({ showNewChat: false, newChatId: "", _previewTimeout: undefined });
  },

  openCtx: (e: React.MouseEvent, msg: Message, isMine: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const flip = window.innerHeight - e.clientY < 280;
    set({
      contextMenu: {
        msg,
        isMine,
        position: {
          x: Math.min(e.clientX, window.innerWidth - 216),
          y: e.clientY,
          flip,
        },
      },
    });
  },
}));
