"use client";

export function GameCard({ game, active, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition duration-300",
        "hover:scale-[1.02] hover:shadow-[0_0_26px_rgba(59,130,246,0.28)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
        active
          ? "border-cyan-300/80 bg-slate-800/85 shadow-[0_0_24px_rgba(56,189,248,0.25)]"
          : "border-slate-700 bg-slate-900/70",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-fuchsia-500/0 via-fuchsia-400/0 to-cyan-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:from-fuchsia-500/10 group-hover:to-cyan-400/10" />
      <div className="relative z-10">
        <p className="text-sm font-medium uppercase tracking-wide text-cyan-200/90">{game.provider || "Provider"}</p>
        <h3 className="mt-2 text-lg font-semibold text-slate-100">{game.name}</h3>
        <p className="mt-1 text-xs text-slate-400">Slug: {game.slug}</p>
      </div>
    </button>
  );
}
