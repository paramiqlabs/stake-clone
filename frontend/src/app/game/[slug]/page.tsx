"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CrashGamePanel } from "@/components/CrashGamePanel";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { fetchGameBySlug } from "@/services/game.service";

export default function GameSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  useRequireAuth();
  const { slug } = use(params);
  const [game, setGame] = useState<null | { id: string; name: string; slug: string }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadGame = async () => {
      setLoading(true);
      try {
        const found = await fetchGameBySlug(slug);
        if (!active) {
          return;
        }
        setGame(found);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadGame();
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div>
      <Link href="/dashboard">Back to Dashboard</Link>
      {loading ? <p>Loading game...</p> : null}
      {!loading ? <p>Game: {game?.name || slug}</p> : null}
      <CrashGamePanel slug={slug} />
    </div>
  );
}
