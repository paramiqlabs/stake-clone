"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useDiceGame } from "@/hooks/useDiceGame";

type DiceResult = {
  roll: number | null;
  win: boolean;
  payout: string;
};

type DiceGameState = {
  amount: string;
  setAmount: (value: string) => void;
  target: number;
  updateTarget: (value: string | number) => void;
  winChance: number;
  payoutMultiplier: number;
  result: DiceResult | null;
  isRolling: boolean;
  error: string;
  walletBalance: string;
  rollDice: () => Promise<void>;
};

export default function DiceGamePage() {
  useRequireAuth();

  const {
    amount,
    setAmount,
    target,
    updateTarget,
    winChance,
    payoutMultiplier,
    result,
    isRolling,
    error,
    walletBalance,
    rollDice,
  } = useDiceGame() as DiceGameState;

  return (
    <section className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-cyan-200 hover:text-cyan-100">
            Back to Dashboard
          </Link>
          <p className="rounded-xl border border-cyan-400/40 bg-slate-900/80 px-3 py-1 text-sm text-cyan-100">
            Wallet: {walletBalance}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h1 className="mb-1 text-3xl font-semibold text-cyan-200">Dice</h1>
          <p className="mb-5 text-sm text-slate-400">Roll under your selected target to win.</p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Bet Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-fuchsia-400"
              />
            </label>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2">
              <p className="text-sm text-slate-300">Target: Roll Under {target}</p>
              <input
                type="range"
                min={1}
                max={99}
                step={1}
                value={target}
                onChange={(event) => updateTarget(event.target.value)}
                className="mt-2 w-full cursor-pointer accent-fuchsia-500"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:grid-cols-2">
            <p className="text-sm text-slate-300">
              Win Chance: <span className="font-semibold text-cyan-200">{winChance}%</span>
            </p>
            <p className="text-sm text-slate-300">
              Multiplier: <span className="font-semibold text-fuchsia-200">{payoutMultiplier}x</span>
            </p>
          </div>

          <button
            type="button"
            onClick={rollDice}
            disabled={isRolling}
            className="glow-button mt-5 w-full rounded-2xl border border-fuchsia-400/60 px-4 py-3 text-base font-semibold text-fuchsia-100 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRolling ? "Rolling..." : "Roll Dice"}
          </button>

          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

          {result ? (
            <div className="mt-5 rounded-2xl border border-cyan-400/35 bg-slate-950/85 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Result</p>
              <p className="mt-2 text-5xl font-bold text-cyan-200">
                {result.roll !== null ? result.roll.toFixed(2) : "-"}
              </p>
              <p className={`mt-2 text-xl font-semibold ${result.win ? "text-emerald-300" : "text-rose-300"}`}>
                {result.win ? "Win" : "Loss"}
              </p>
              <p className="mt-1 text-lg text-slate-200">Payout: {result.payout}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
