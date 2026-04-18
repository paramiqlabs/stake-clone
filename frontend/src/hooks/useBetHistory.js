"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyBets } from "@/services/bet.service";

const MAX_HISTORY = 20;

const normalizeBet = (bet) => {
  if (!bet) {
    return null;
  }

  return {
    id: String(bet.id || ""),
    amount: String(bet.amount ?? "0"),
    payout: bet.payout !== undefined && bet.payout !== null ? String(bet.payout) : null,
    status: String(bet.status || "pending"),
    crashRoundId: bet.crashRoundId ? String(bet.crashRoundId) : null,
    cashoutMultiplier:
      bet.cashoutMultiplier !== undefined && bet.cashoutMultiplier !== null
        ? String(bet.cashoutMultiplier)
        : null,
    createdAt: bet.createdAt || new Date().toISOString(),
  };
};

const sortLatestFirst = (bets) =>
  [...bets].sort((a, b) => {
    const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    const aId = Number(a.id || 0);
    const bId = Number(b.id || 0);
    return bId - aId;
  });

const capHistory = (bets, maxEntries) => sortLatestFirst(bets).slice(0, Math.min(maxEntries, MAX_HISTORY));

export const useBetHistory = ({ maxEntries = 20 } = {}) => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getMyBets(Math.min(maxEntries, MAX_HISTORY));
      const normalized = data.map(normalizeBet).filter(Boolean);
      setBets(capHistory(normalized, maxEntries));
    } catch (fetchError) {
      setError(fetchError?.message || "Failed to fetch bet history");
    } finally {
      setLoading(false);
    }
  }, [maxEntries]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const onBetPlaced = useCallback(
    (bet) => {
      const normalized = normalizeBet(bet);
      if (!normalized) {
        return;
      }

      setBets((current) => {
        const withoutExisting = current.filter((entry) => entry.id !== normalized.id);
        return capHistory([normalized, ...withoutExisting], maxEntries);
      });
    },
    [maxEntries]
  );

  const onCashoutSuccess = useCallback(
    (payload) => {
      const roundId = payload?.roundId ? String(payload.roundId) : null;
      const betId = payload?.bet?.id
        ? String(payload.bet.id)
        : payload?.betId
          ? String(payload.betId)
          : null;

      setBets((current) => {
        const updated = current.map((entry) => {
          const idMatch = betId && entry.id === betId;
          const roundMatch = roundId && entry.crashRoundId === roundId && entry.status === "pending";

          if (!idMatch && !roundMatch) {
            return entry;
          }

          return {
            ...entry,
            status: "won",
            payout:
              payload?.payout !== undefined && payload?.payout !== null ? String(payload.payout) : entry.payout,
            cashoutMultiplier:
              payload?.cashoutMultiplier !== undefined && payload?.cashoutMultiplier !== null
                ? String(payload.cashoutMultiplier)
                : payload?.multiplier !== undefined && payload?.multiplier !== null
                  ? String(payload.multiplier)
                : entry.cashoutMultiplier,
          };
        });

        return capHistory(updated, maxEntries);
      });
    },
    [maxEntries]
  );

  const onCrashEnd = useCallback(
    (payload) => {
      const roundId = payload?.roundId ? String(payload.roundId) : null;
      if (!roundId) {
        return;
      }

      setBets((current) => {
        const updated = current.map((entry) => {
          if (entry.crashRoundId !== roundId || entry.status !== "pending") {
            return entry;
          }

          return {
            ...entry,
            status: "lost",
            payout: null,
          };
        });

        return capHistory(updated, maxEntries);
      });
    },
    [maxEntries]
  );

  const history = useMemo(() => capHistory(bets, maxEntries), [bets, maxEntries]);

  return {
    bets: history,
    loading,
    error,
    refreshHistory,
    onBetPlaced,
    onCashoutSuccess,
    onCrashEnd,
  };
};
