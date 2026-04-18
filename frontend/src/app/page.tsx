"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
      return;
    }

    router.replace("/login");
  }, [router, token]);

  return <p>Redirecting...</p>;
}

