"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { useChatStore } from "@/stores/chatStore";
import { Contact } from "@/types/chat";

//  Generic Cache Updater
const updateContactCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  customChatId: string,
  changes: Partial<Contact>,
) => {
  queryClient.setQueryData(
    ["contacts", userId],
    (old: Contact[] | undefined) => {
      if (!old) return old;
      return old.map((c) =>
        c.customChatId === customChatId ? { ...c, ...changes } : c,
      );
    },
  );
};

//  1. Global Lock Password Set
export const useSetLockPasswordGlobal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pin }: { pin: string }) => {
      const { data } = await api.put("/chats/add-lock-password", { pin });
      if (!data.success)
        throw new Error(data.message || "Failed to set master password");
      return data;
    },

    onSuccess: () => {
      useAuthStore.setState({ isChatLockEnabled: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData(["auth"], (old: any) => {
        if (!old) return old;
        return { ...old, isChatLockEnabled: true };
      });
      toast.success("Chat lock enabled successfully!");
    },

    onError: (error: Error) => {
      toast.error(error.message || "Failed to set master password");
      console.error("Error setting master password:", error);
    },
  });
};

//  2. Verify Global PIN

export const useVerifyGlobalPin = () => {
  return useMutation({
    mutationFn: async ({ pin }: { pin: string }) => {
      const { data } = await api.put("/chats/verify-pin", { pin });
      if (!data.success) throw new Error(data.message || "Invalid PIN");
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Invalid PIN");
      console.error("Error verifying global PIN:", error);
    },
  });
};

//  4. Lock a Chat
// POST /chats/lock/:customChatId
export const useLockChat = (customChatId: string) => {
  const queryClient = useQueryClient();
  const userId = useAuthStore.getState().myId;

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/chats/lock/${customChatId}`);
      if (!data.success) throw new Error(data.message || "Failed to lock chat");
      return data;
    },

    onMutate: async () => {
      const previousContacts = useChatStore.getState().contacts;
      useChatStore.setState((state) => ({
        contacts: state.contacts.map((c) =>
          c.customChatId === customChatId ? { ...c, isChatLock: true } : c,
        ),
      }));
      return { previousContacts };
    },

    onSuccess: () => {
      updateContactCache(queryClient, userId, customChatId, {
        isChatLock: true,
      });
      toast.success("Chat locked successfully!");
    },

    onError: (error: Error, _, context) => {
      if (context?.previousContacts) {
        useChatStore.setState({ contacts: context.previousContacts });
      }
      toast.error(error.message || "Failed to lock chat.");
      console.error("Error locking chat:", error);
    },
  });
};

//  5. Unlock a Chat
// PATCH /chats/unlock/:customChatId
export const useUnlockChat = (customChatId: string) => {
  const queryClient = useQueryClient();
  const userId = useAuthStore.getState().myId;

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/chats/unlock/${customChatId}`);
      if (!data.success)
        throw new Error(data.message || "Failed to unlock chat");
      return data;
    },

    onMutate: async () => {
      const previousContacts = useChatStore.getState().contacts;
      useChatStore.setState((state) => ({
        contacts: state.contacts.map((c) =>
          c.customChatId === customChatId ? { ...c, isChatLock: false } : c,
        ),
      }));
      return { previousContacts };
    },

    onSuccess: () => {
      updateContactCache(queryClient, userId, customChatId, {
        isChatLock: false,
      });
      toast.success("Chat unlocked successfully!");
    },

    onError: (error: Error, _, context) => {
      toast.error(error.message || "Failed to unlock chat.");
      if (context?.previousContacts) {
        useChatStore.setState({ contacts: context.previousContacts });
      }
    },
  });
};

//  6. Change PIN
// PATCH /chats/change-pin
export const useChangeLockPin = () => {
  return useMutation({
    mutationFn: async ({
      oldPin,
      newPin,
    }: {
      oldPin: string;
      newPin: string;
    }) => {
      const { data } = await api.patch("/chats/change-pin", { oldPin, newPin });
      if (!data.success)
        throw new Error(data.message || "Failed to change PIN");
      return data;
    },

    onSuccess: () => {
      toast.success("PIN changed successfully!");
    },

    onError: (error: Error) => {
      toast.error("Failed to change PIN. Check your old PIN.");
      console.error("Error changing PIN:", error);
    },
  });
};
