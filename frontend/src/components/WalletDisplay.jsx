"use client";

export function WalletDisplay({ balance }) {
  return (
    <div className="rounded-2xl border border-cyan-400/40 bg-slate-900/80 px-4 py-2 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
      <p className="text-xs uppercase tracking-wider text-cyan-200/85">Wallet</p>
      <p className="text-lg font-semibold text-slate-100">{balance}</p>
    </div>
  );
}
