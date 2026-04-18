"use client";

import { useCallback, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "@/store/useAuthStore";

const DEFAULT_CLIENT_SEED = "stake-clone-client-seed";

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
  const [currentBetId, setCurrentBetId] = useState("");
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [revealedSeed, setRevealedSeed] = useState(null);

  const socketEvents = useMemo(
    () => ({
      crash_start: (payload) => {
        setStatus(payload?.status || "running");
        setCurrentMultiplier(Number(payload?.multiplier || 1));
        setIsCrashed(false);
        setIsCashingOut(false);
        setRevealedSeed(null);
      },
      crash_seed_hash: (payload) => {
        setServerSeedHash(String(payload?.serverSeedHash || ""));
        setRevealedSeed(null);
      },
      crash_seed_reveal: (payload) => {
        const nextHash = String(payload?.serverSeedHash || "");
        if (nextHash) {
          setServerSeedHash(nextHash);
        }

        setRevealedSeed({
          serverSeed: String(payload?.serverSeed || ""),
          nonce: payload?.nonce !== undefined && payload?.nonce !== null ? String(payload.nonce) : "",
          clientSeed: String(payload?.clientSeed || DEFAULT_CLIENT_SEED),
        });
      },
      crash_tick: (payload) => {
        setStatus(payload?.status || "running");
        setCurrentMultiplier(Number(payload?.multiplier || 1));
      },
      bet_placed: async (payload) => {
        const directBet = payload?.bet || null;
        const directUserId = directBet?.userId;
        const broadcastUserId = payload?.userId;
        const eventUserId = directUserId || broadcastUserId;

        if (!eventUserId || String(eventUserId) !== String(userId || "")) {
          return;
        }

        setHasPlacedBet(true);
        setHasCashedOut(false);
        setIsPlacingBet(false);

        if (directBet?.id) {
          setCurrentBetId(String(directBet.id));
          onBetPlaced?.(directBet);
        }

        if (payload?.wallet?.balance !== undefined) {
          onWalletBalance?.(payload.wallet.balance);
        } else {
          await onWalletRefresh?.();
        }

        setLastMessage("Bet placed");
      },
      cashout_success: async (payload) => {
        const isBroadcastPayload = payload?.userId !== undefined && payload?.userId !== null;
        if (isBroadcastPayload && String(payload.userId) !== String(userId || "")) {
          return;
        }

        setHasCashedOut(true);
        setIsCashingOut(false);
        setCurrentBetId("");

        if (payload?.newBalance !== undefined) {
          onWalletBalance?.(payload.newBalance);
        } else if (payload?.wallet?.balance !== undefined) {
          onWalletBalance?.(payload.wallet.balance);
        } else {
          await onWalletRefresh?.();
        }

        setLastMessage(payload?.payout ? `Cashout success: ${payload.payout}` : "Cashout successful");
        onCashoutSuccess?.(payload);
      },
      cashout_error: (payload) => {
        console.error("cashout_error", payload);
        setIsCashingOut(false);
        setLastMessage(payload?.message || "Cashout failed");
      },
      crash_end: (payload) => {
        setStatus("crashed");
        setCurrentMultiplier(1);
        setHasPlacedBet(false);
        setHasCashedOut(false);
        setIsCashingOut(false);
        setIsCrashed(true);
        setCurrentBetId("");
        onCrashEnd?.(payload);
      },
      socket_error: (payload) => {
        console.error("socket_error", payload);
        setIsPlacingBet(false);
        setIsCashingOut(false);
        setLastMessage(payload?.message || "Socket error");
      },
    }),
    [onBetPlaced, onCrashEnd, onCashoutSuccess, onWalletBalance, onWalletRefresh, userId]
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

    const socket = getSocket();
    if (!socket) {
      setLastMessage("Socket not connected");
      return;
    }

    setIsPlacingBet(true);
    setLastMessage("");
    socket.emit("crash_bet", { amount: normalizedAmount });
  }, [betAmount, gameId, hasPlacedBet, isPlacingBet]);

  const cashout = useCallback(() => {
    console.log("cashout click", { currentBetId, hasPlacedBet, hasCashedOut, isCrashed, isCashingOut });
    if (!hasPlacedBet || hasCashedOut || isCrashed || isCashingOut) {
      return;
    }

    const socket = getSocket();
    if (!socket) {
      setLastMessage("Socket not connected");
      return;
    }

    setIsCashingOut(true);
    const payload = { betId: currentBetId };
    console.log('socket.emit("crash_cashout")', payload);
    socket.emit("crash_cashout", payload);
  }, [currentBetId, hasPlacedBet, hasCashedOut, isCrashed, isCashingOut]);

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
    currentBetId,
    lastMessage,
    serverSeedHash,
    revealedSeed,
    connected,
    reconnecting,
    placeCrashBet,
    cashout,
  };
};
