"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchGames, launchGame } from "@/services/game.service";
import { getWalletBalance } from "@/services/wallet.service";
import { GameCard } from "@/components/GameCard";
import { WalletDisplay } from "@/components/WalletDisplay";
import { GameIframeContainer } from "@/components/GameIframeContainer";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuthStore } from "@/store/useAuthStore";

type LobbyGame = {
  id: string;
  name: string;
  slug: string;
  provider?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const token = useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const walletBalance = useAuthStore((state) => state.walletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);
  const logout = useAuthStore((state) => state.logout);

  const [games, setGames] = useState<LobbyGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [launchUrl, setLaunchUrl] = useState("");
  const [error, setError] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);

  const activeGame = useMemo(
    () => games.find((game) => String(game.id) === String(selectedGameId)) || null,
    [games, selectedGameId]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const [gamesResponse, walletResponse] = await Promise.all([
          fetchGames(),
          getWalletBalance(),
        ]);

        if (!isMounted) {
          return;
        }

        const normalizedGames: LobbyGame[] = Array.isArray(gamesResponse)
          ? gamesResponse.map((game) => ({
              id: String(game?.id || ""),
              name: String(game?.name || "Untitled"),
              slug: String(game?.slug || ""),
              provider: game?.provider ? String(game.provider) : "Provider",
            }))
          : [];

        setGames(normalizedGames);
        if (normalizedGames.length > 0) {
          setSelectedGameId(normalizedGames[0].id);
        }
        setWalletBalance(walletResponse || "0");
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Unable to load dashboard";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [token, setWalletBalance]);

  const handleLaunchGame = useCallback(
    async (gameId: string) => {
      if (!gameId) {
        return;
      }

      setLaunching(true);
      setLaunchError("");
      try {
        const data = await launchGame(gameId);
        const url = typeof data?.launchUrl === "string" ? data.launchUrl : "";
        if (!url) {
          throw new Error("Launch URL is missing");
        }

        setLaunchUrl(url);
      } catch (launchRequestError) {
        setLaunchUrl("");
        setLaunchError(
          launchRequestError instanceof Error
            ? launchRequestError.message
            : "Unable to launch game"
        );
      } finally {
        setLaunching(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedGameId || loading) {
      return;
    }

    handleLaunchGame(selectedGameId);
  }, [selectedGameId, loading, handleLaunchGame]);

  return (
    <section className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-3xl border border-slate-800 bg-slate-900/65 p-4 backdrop-blur-sm">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold tracking-tight text-cyan-200">Lobby</h1>
            <p className="text-sm text-slate-400">{user?.email || user?.id || "Unknown user"}</p>
          </div>

          {loading ? <div className="h-24 w-full shimmer rounded-xl" /> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <div className="space-y-3">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                active={String(game.id) === String(selectedGameId)}
                disabled={launching && String(game.id) === String(selectedGameId)}
                onClick={() => {
                  setSelectedGameId(String(game.id));
                  setLaunchError("");
                }}
              />
            ))}
          </div>
        </aside>

        <main className="flex min-h-[70vh] flex-col rounded-3xl border border-slate-800 bg-slate-900/65 p-4 backdrop-blur-sm">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <WalletDisplay balance={walletBalance} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-fuchsia-400/60 px-4 py-2 text-sm font-medium text-fuchsia-100 glow-button transition hover:scale-[1.03]"
                onClick={() => handleLaunchGame(selectedGameId)}
                disabled={!selectedGameId || launching}
              >
                {launching ? "Launching..." : "Launch Game"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:scale-[1.03] hover:border-slate-500"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
              >
                Logout
              </button>
            </div>
          </div>

          <GameIframeContainer
            title={activeGame?.name || "Provider Game"}
            launchUrl={launchUrl}
            loading={launching || loading}
            error={launchError}
          />
        </main>
      </div>
    </section>
  );
}
