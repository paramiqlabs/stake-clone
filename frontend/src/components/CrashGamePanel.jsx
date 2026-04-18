"use client";

import { useMemo, useState } from "react";
import { getSocket } from "@/lib/socket";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "@/store/useAuthStore";

export function CrashGamePanel({ slug }) {
  const token = useAuthStore((state) => state.token);
  const walletBalance = useAuthStore((state) => state.walletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);

  const [status, setStatus] = useState("waiting");
  const [multiplier, setMultiplier] = useState(1);
  const [betAmount, setBetAmount] = useState("1");
  const [lastMessage, setLastMessage] = useState("");
  const [roundResult, setRoundResult] = useState(null);

  const socketEvents = useMemo(
    () => ({
      crash_start: (payload) => {
        setStatus(payload?.status || "running");
        setMultiplier(Number(payload?.multiplier || 1));
        setRoundResult(null);
      },
      crash_tick: (payload) => {
        setStatus(payload?.status || "running");
        setMultiplier(Number(payload?.multiplier || 1));
      },
      crash_end: (payload) => {
        setStatus(payload?.status || "crashed");
        setMultiplier(Number(payload?.multiplier || 1));
        setLastMessage(`Round ended at ${Number(payload?.multiplier || 1).toFixed(2)}x`);
      },
      bet_placed: (payload) => {
        if (payload?.wallet?.balance !== undefined) {
          setWalletBalance(payload.wallet.balance);
        }
        setLastMessage("Bet placed");
      },
      cashout_success: (payload) => {
        if (payload?.wallet?.balance !== undefined) {
          setWalletBalance(payload.wallet.balance);
        }
        if (payload?.payout) {
          setLastMessage(`Cashout success: ${payload.payout}`);
        }
      },
      crash_result: (payload) => {
        setRoundResult(payload);
      },
      socket_error: (payload) => {
        setLastMessage(payload?.message || "Socket error");
      },
    }),
    [setWalletBalance]
  );

  const { connected, reconnecting } = useSocket({
    token,
    events: socketEvents,
  });

  const multiplierDisplay = useMemo(() => `${Number(multiplier || 1).toFixed(2)}x`, [multiplier]);

  const placeCrashBet = () => {
    const socket = getSocket();
    if (!socket) {
      setLastMessage("Socket not connected");
      return;
    }

    socket.emit("crash_bet", {
      amount: betAmount,
    });
  };

  const cashout = () => {
    const socket = getSocket();
    if (!socket) {
      setLastMessage("Socket not connected");
      return;
    }

    socket.emit("crash_cashout");
  };

  if (slug !== "crash") {
    return (
      <section>
        <h2>Unsupported game</h2>
        <p>This page currently supports only the crash game.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Crash Game</h1>
      <p>Socket: {connected ? "Connected" : reconnecting ? "Reconnecting..." : "Disconnected"}</p>
      <p>Status: {status}</p>
      <p style={{ fontSize: "64px", fontWeight: "700", margin: "10px 0" }}>{multiplierDisplay}</p>
      <p>Wallet Balance: {walletBalance}</p>
      <div>
        <label htmlFor="bet-amount">Bet amount</label>
        <input
          id="bet-amount"
          type="number"
          min="0.01"
          step="0.01"
          value={betAmount}
          onChange={(event) => setBetAmount(event.target.value)}
        />
      </div>
      <div>
        <button type="button" onClick={placeCrashBet}>
          Place Bet
        </button>
        <button type="button" onClick={cashout}>
          Cash Out
        </button>
      </div>
      {lastMessage ? <p>{lastMessage}</p> : null}
      {roundResult ? (
        <div>
          <p>Round Result</p>
          <p>Final: {roundResult.finalMultiplier}x</p>
          <p>Won bets: {roundResult.wonCount}</p>
          <p>Lost bets: {roundResult.lostCount}</p>
        </div>
      ) : null}
    </section>
  );
}
