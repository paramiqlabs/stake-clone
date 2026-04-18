"use client";

import { useMemo } from "react";
import { useCrashGame } from "@/hooks/useCrashGame";
import { useBetHistory } from "@/hooks/useBetHistory";
import { useWallet } from "@/hooks/useWallet";

export function CrashGamePanel({ slug, gameId }) {
  const { balance: walletBalance, updateBalance, refreshBalance } = useWallet();
  const { bets, loading: historyLoading, error: historyError, onBetPlaced, onCashoutSuccess, onCrashEnd } = useBetHistory({
    maxEntries: 20,
  });
  const {
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
  } = useCrashGame({
    gameId,
    onWalletBalance: updateBalance,
    onWalletRefresh: refreshBalance,
    onBetPlaced,
    onCashoutSuccess,
    onCrashEnd,
  });

  const multiplierDisplay = useMemo(
    () => `${Number(currentMultiplier || 1).toFixed(2)}x`,
    [currentMultiplier]
  );

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
          disabled={hasPlacedBet || isPlacingBet}
        />
      </div>
      <div>
        <button type="button" onClick={placeCrashBet} disabled={hasPlacedBet || isPlacingBet}>
          {isPlacingBet ? "Placing..." : "Place Bet"}
        </button>
        <button type="button" onClick={cashout} disabled={!hasPlacedBet || hasCashedOut || isCrashed || isCashingOut}>
          {isCashingOut ? "Cashing out..." : "Cashout"}
        </button>
      </div>
      <p>Bet placed: {hasPlacedBet ? "Yes" : "No"}</p>
      <p>Cashed out: {hasCashedOut ? "Yes" : "No"}</p>
      {lastMessage ? <p>{lastMessage}</p> : null}
      <h2>My Bets</h2>
      {historyLoading ? <p>Loading bet history...</p> : null}
      {historyError ? <p>{historyError}</p> : null}
      {!historyLoading ? (
        <table>
          <thead>
            <tr>
              <th>Amount</th>
              <th>Multiplier</th>
              <th>Result</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {bets.length ? (
              bets.map((bet) => {
                const status = String(bet.status || "").toLowerCase();
                const resultColor = status === "won" ? "green" : status === "lost" ? "red" : "inherit";
                const derivedMultiplier =
                  status === "won" &&
                  !bet.cashoutMultiplier &&
                  bet.payout &&
                  Number(bet.amount) > 0
                    ? Number(bet.payout) / Number(bet.amount)
                    : null;
                const multiplier =
                  status === "won" && bet.cashoutMultiplier
                    ? `${Number(bet.cashoutMultiplier).toFixed(2)}x`
                    : status === "won" && derivedMultiplier
                      ? `${Number(derivedMultiplier).toFixed(2)}x`
                    : "-";

                return (
                  <tr key={bet.id}>
                    <td>{bet.amount}</td>
                    <td>{multiplier}</td>
                    <td style={{ color: resultColor }}>{status}</td>
                    <td>{new Date(bet.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4}>No bets yet</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
