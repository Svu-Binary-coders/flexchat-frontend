import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import api from "@/lib/axios";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { KeyManager } from "@/core/e2e/KeyManager";
import { useSessionStore } from "@/stores/sessionStore";

export const useAuth = () => {
  const query = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me");
      if (!data.success) throw new Error("Unauthorized");
      return data.userDetails;
    },
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    const setupSession = async () => {
      if (query.data) {
        const activeKeys = await KeyManager.loadActiveKeys();

        useSessionStore.setState({
          userId: query.data.id,
          privateKey: activeKeys?.privateKey || null,
          signingKey: activeKeys?.signingKey || null,
          needPin: !activeKeys,
        });

        useAuthStore.setState({
          myId: query.data.id,
          myDetails: query.data,
          isAuthenticated: true,
          isChatLockEnabled: query.data.is_chat_lock_enabled,
        });

        // socket setup
        const { socket } = useChatStore.getState();
        socket?.emit("setup", query.data.id);
      }
    };

    setupSession();
  }, [query.data]);

  return query;
};
