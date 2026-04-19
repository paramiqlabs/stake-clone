"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { JWT_KEY } from "@/services/apiClient";

const getStorage = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
};

const writeToken = (token) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (!token) {
    storage.removeItem(JWT_KEY);
    return;
  }

  storage.setItem(JWT_KEY, token);
};

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      walletBalance: "0",
      setAuth: ({ user, token }) => {
        writeToken(token);
        set({
          user: user || null,
          token: token || null,
        });
      },
      setWalletBalance: (walletBalance) => {
        set({ walletBalance: String(walletBalance ?? "0") });
      },
      logout: () => {
        writeToken(null);
        set({
          user: null,
          token: null,
          walletBalance: "0",
        });
      },
    }),
    {
      name: "stake-auth-store",
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        walletBalance: state.walletBalance,
      }),
    }
  )
);
