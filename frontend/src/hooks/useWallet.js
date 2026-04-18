"use client";

import { useCallback, useEffect, useState } from "react";
import { getWalletBalance } from "@/services/wallet.service";
import { useAuthStore } from "@/store/useAuthStore";

export const useWallet = () => {
  const token = useAuthStore((state) => state.token);
  const storedBalance = useAuthStore((state) => state.walletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);

  const [balance, setBalance] = useState(String(storedBalance ?? "0"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateBalance = useCallback(
    (nextBalance) => {
      const normalized = String(nextBalance ?? "0");
      setBalance(normalized);
      setWalletBalance(normalized);
    },
    [setWalletBalance]
  );

  const refreshBalance = useCallback(async () => {
    if (!token) {
      return null;
    }

    setLoading(true);
    setError("");

    try {
      const nextBalance = await getWalletBalance();
      updateBalance(nextBalance);
      return nextBalance;
    } catch (fetchError) {
      setError(fetchError?.message || "Failed to fetch wallet balance");
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, updateBalance]);

  useEffect(() => {
    setBalance(String(storedBalance ?? "0"));
  }, [storedBalance]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  return {
    balance,
    loading,
    error,
    refreshBalance,
    updateBalance,
  };
};
