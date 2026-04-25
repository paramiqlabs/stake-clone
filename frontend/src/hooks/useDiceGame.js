"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playDice } from "@/services/dice.service";
import { getWalletBalance } from "@/services/wallet.service";
import { useAuthStore } from "@/store/useAuthStore";

const clampTarget = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 50;
  }

  return Math.min(99, Math.max(1, Math.round(numeric)));
};

export const useDiceGame = () => {
  const walletBalance = useAuthStore((state) => state.walletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);
  const rollingIntervalRef = useRef(null);

  const [amount, setAmount] = useState("1.00");
  const [target, setTarget] = useState(50);
  const [rollingValue, setRollingValue] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [error, setError] = useState("");

  const clearRollingInterval = useCallback(() => {
    if (!rollingIntervalRef.current) {
      return;
    }

    clearInterval(rollingIntervalRef.current);
    rollingIntervalRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;

    const loadWallet = async () => {
      try {
        const balance = await getWalletBalance();
        if (active) {
          setWalletBalance(balance || "0");
        }
      } catch {
        // Keep existing store value if wallet fetch fails.
      }
    };

    loadWallet();
    return () => {
      active = false;
      clearRollingInterval();
    };
  }, [clearRollingInterval, setWalletBalance]);

  const winChance = useMemo(() => target, [target]);

  const payoutMultiplier = useMemo(
    () => Number(((100 / target) * 0.99).toFixed(4)),
    [target]
  );

  const updateTarget = useCallback((nextValue) => {
    setTarget(clampTarget(nextValue));
    setError("");
  }, []);

  const rollDice = useCallback(async () => {
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setError("Enter a valid bet amount");
      return;
    }

    setIsRolling(true);
    setError("");
    setFinalResult(null);
    setRollingValue(Math.floor(Math.random() * 100));
    clearRollingInterval();
    rollingIntervalRef.current = setInterval(() => {
      setRollingValue(Math.floor(Math.random() * 100));
    }, 50);

    try {
      const data = await playDice({
        amount: normalizedAmount,
        target,
      });

      const bet = data?.bet || {};
      const gameResult = bet?.result || {};

      const rolledValue = data?.roll ?? gameResult?.roll;
      const didWin = data?.win ?? gameResult?.won;
      const payoutValue = data?.payout ?? bet?.payout ?? "0";
      const nextBalance = data?.newBalance ?? data?.wallet?.balance;

      clearRollingInterval();

      if (nextBalance !== undefined && nextBalance !== null) {
        setWalletBalance(String(nextBalance));
      } else {
        const freshBalance = await getWalletBalance();
        setWalletBalance(freshBalance || "0");
      }

      const resolvedRoll =
        rolledValue !== undefined && rolledValue !== null ? Number(rolledValue) : null;
      setRollingValue(resolvedRoll);
      setFinalResult({
        roll: resolvedRoll,
        win: Boolean(didWin),
        payout: String(payoutValue ?? "0"),
      });
    } catch (rollError) {
      clearRollingInterval();
      setRollingValue(null);
      setFinalResult(null);
      setError(rollError instanceof Error ? rollError.message : "Failed to roll dice");
    } finally {
      setIsRolling(false);
    }
  }, [amount, clearRollingInterval, setWalletBalance, target]);

  return {
    amount,
    setAmount,
    target,
    updateTarget,
    winChance,
    payoutMultiplier,
    rollingValue,
    finalResult,
    isRolling,
    error,
    walletBalance,
    rollDice,
  };
};
