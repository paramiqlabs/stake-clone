"use client";

import { useCallback, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket";
import { useSocket } from "@/hooks/useSocket";
import { placeBet } from "@/services/bet.service";
import { useAuthStore } from "@/store/useAuthStore";

export const useCrashGame = ({
  gameId,
  onWalletBalance,
  onWalletRefresh,
  onBetPlaced,
  onCashoutSuccess,
  onCrashEnd,
}) => {
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);

  const [status, setStatus] = useState("waiting");
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [hasPlacedBet, setHasPlacedBet] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [betAmount, setBetAmount] = useState("1");
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [isCrashed, setIsCrashed] = useState(false);
  const [lastMessage, setLastMessage] = useState("");

  const socketEvents = useMemo(
    () => ({
      crash_start: (payload) => {
        setStatus(payload?.status || "running");
        setCurrentMultiplier(Number(payload?.multiplier || 1));
        setIsCrashed(false);
        setIsCashingOut(false);
      },
      crash_tick: (payload) => {
        setStatus(payload?.status || "running");
        setCurrentMultiplier(Number(payload?.multiplier || 1));
      },
      cashout_success: async (payload) => {
        const isBroadcastPayload = payload?.userId !== undefined && payload?.userId !== null;
        if (isBroadcastPayload && String(payload.userId) !== String(userId || "")) {
          return;
        }

        if (isBroadcastPayload && payload?.wallet === undefined && payload?.bet === undefined) {
          return;
        }

        setHasCashedOut(true);
        setIsCashingOut(false);

        if (payload?.wallet?.balance !== undefined) {
          onWalletBalance?.(payload.wallet.balance);
        } else {
          await onWalletRefresh?.();
        }

        setLastMessage(payload?.payout ? `Cashout success: ${payload.payout}` : "Cashout successful");
        onCashoutSuccess?.(payload);
      },
      crash_end: (payload) => {
        setStatus("crashed");
        setCurrentMultiplier(1);
        setHasPlacedBet(false);
        setHasCashedOut(false);
        setIsCashingOut(false);
        setIsCrashed(true);
        onCrashEnd?.(payload);
      },
      socket_error: (payload) => {
        setIsCashingOut(false);
        setLastMessage(payload?.message || "Socket error");
      },
    }),
    [onCrashEnd, onCashoutSuccess, onWalletBalance, onWalletRefresh, userId]
  );

  const { connected, reconnecting } = useSocket({ token, events: socketEvents });

  const placeCrashBet = useCallback(async () => {
    if (hasPlacedBet || isPlacingBet) {
      return;
    }

    if (!gameId) {
      setLastMessage("Game not found");
      return;
    }

    const normalizedAmount = Number(betAmount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setLastMessage("Enter a valid bet amount");
      return;
    }

    setIsPlacingBet(true);
    setLastMessage("");

    try {
      const result = await placeBet({
        gameId,
        amount: normalizedAmount,
      });

      setHasPlacedBet(true);
      setHasCashedOut(false);
      onBetPlaced?.(result?.bet);

      if (result?.wallet?.balance !== undefined) {
        onWalletBalance?.(result.wallet.balance);
      } else {
        await onWalletRefresh?.();
      }

      setLastMessage("Bet placed");
    } catch (error) {
      setLastMessage(error?.message || "Failed to place bet");
    } finally {
      setIsPlacingBet(false);
    }
  }, [betAmount, gameId, hasPlacedBet, isPlacingBet, onBetPlaced, onWalletBalance, onWalletRefresh]);

  const cashout = useCallback(() => {
    if (!hasPlacedBet || hasCashedOut || isCrashed || isCashingOut) {
      return;
    }

    const socket = getSocket();
    if (!socket) {
      setLastMessage("Socket not connected");
      return;
    }

    setIsCashingOut(true);
    socket.emit("crash_cashout");
  }, [hasPlacedBet, hasCashedOut, isCrashed, isCashingOut]);

  return {
    status,
    currentMultiplier,
    hasPlacedBet,
    hasCashedOut,
    betAmount,
    setBetAmount,
    isPlacingBet,
    isCashingOut,
    isCrashed,
    lastMessage,
    connected,
    reconnecting,
    placeCrashBet,
    cashout,
  };
};
