"use client";

import Link from "next/link";
import { CrashGamePanel } from "@/components/CrashGamePanel";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function GameSlugPage({ params }: { params: { slug: string } }) {
  useRequireAuth();

  return (
    <div>
      <Link href="/dashboard">Back to Dashboard</Link>
      <CrashGamePanel slug={params.slug} />
    </div>
  );
}

