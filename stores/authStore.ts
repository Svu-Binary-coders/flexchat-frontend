import { create } from "zustand";
import { persist } from "zustand/middleware";
import { IMyDetails } from "@/interface/auth.interface";

interface AuthStore {
  myId: string;
  isChatLockEnabled: boolean;
  myDetails: IMyDetails | null;
  isAuthenticated: boolean;
  setAuth: (details: IMyDetails) => void;
  setMyDetails: (details: Partial<IMyDetails>) => void;
  logout: () => void;
  
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      myId: "",
      myDetails: null,
      isAuthenticated: false,
      isChatLockEnabled: false,

      setAuth: (details) =>
        set({
          myId: details.id,
          myDetails: details,
          isAuthenticated: true,
          isChatLockEnabled: details.is_chat_lock_enabled,
        }),

      setMyDetails: (updatedDetails) =>
        set((state) => ({
          myDetails: state.myDetails
            ? { ...state.myDetails, ...updatedDetails }
            : (updatedDetails as IMyDetails),
        })),

      logout: () => set({ myId: "", myDetails: null, isAuthenticated: false }),
    }),
    {
      name: "auth-store",
    },
  ),
);
