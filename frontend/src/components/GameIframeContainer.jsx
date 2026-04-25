"use client";

export function GameIframeContainer({ title, launchUrl, loading, error, onExit }) {
  if (loading) {
    return (
      <div className="h-full min-h-[420px] w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="mb-4 h-6 w-40 shimmer rounded-md" />
        <div className="h-[340px] w-full shimmer rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[420px] w-full items-center justify-center rounded-2xl border border-rose-400/40 bg-slate-900/60 p-6">
        <p className="text-sm text-rose-200">{error}</p>
      </div>
    );
  }

  if (!launchUrl) {
    return (
      <div className="flex min-h-[420px] w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
        <p className="text-sm text-slate-300">Select a game from the sidebar to launch.</p>
      </div>
    );
  }

  return (
    <div className="fade-in h-full min-h-[420px] w-full overflow-hidden rounded-2xl border border-cyan-400/40 bg-slate-900/70 p-3 shadow-[0_0_28px_rgba(59,130,246,0.2)]">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-xs uppercase tracking-wide text-cyan-200/90">{title || "Game"}</p>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-rose-300/50 px-3 py-1 text-xs font-medium text-rose-100 transition hover:scale-[1.02] hover:border-rose-200"
        >
          Exit Game
        </button>
      </div>
      <iframe
        title={title || "Game"}
        src={launchUrl}
        className="h-[70vh] min-h-[520px] w-full rounded-xl border border-slate-700 bg-slate-950"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
