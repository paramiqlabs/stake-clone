"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchGames } from "@/services/game.service";
import { getWalletBalance } from "@/services/wallet.service";
import { GamesList } from "@/components/GamesList";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuthStore } from "@/store/useAuthStore";

export default function DashboardPage() {
  const router = useRouter();
  const token = useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const walletBalance = useAuthStore((state) => state.walletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);
  const logout = useAuthStore((state) => state.logout);

  const [games, setGames] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

        setGames(gamesResponse || []);
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

  return (
    <section>
      <h1>Dashboard</h1>
      <p>User: {user?.email || user?.id || "Unknown"}</p>
      <p>Wallet Balance: {walletBalance}</p>
      <button
        type="button"
        onClick={() => {
          logout();
          router.replace("/login");
        }}
      >
        Logout
      </button>

      {loading ? <p>Loading games...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && !error ? <GamesList games={games} /> : null}
    </section>
  );
}
