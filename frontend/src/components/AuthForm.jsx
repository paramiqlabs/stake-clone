"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/services/auth.service";
import { parseJwtPayload } from "@/lib/jwt";
import { useAuthStore } from "@/store/useAuthStore";

const INITIAL_FORM = {
  email: "",
  password: "",
};

export function AuthForm() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChangeField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await register(form);
      }

      const token = await login(form);
      const payload = parseJwtPayload(token);
      setAuth({
        token,
        user: payload
          ? {
              id: payload.userId ? String(payload.userId) : null,
              role: payload.role || "user",
              email: form.email,
            }
          : { email: form.email, role: "user" },
      });
      setWalletBalance("0");
      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError?.message || "Unable to continue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_0_32px_rgba(59,130,246,0.1)]">
      <h1 className="mb-4 text-2xl font-semibold text-cyan-200">{mode === "login" ? "Login" : "Register"}</h1>
      <div className="mb-3">
        <label htmlFor="email" className="mb-1 block text-sm text-slate-300">Email</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => onChangeField("email", event.target.value)}
          required
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
        />
      </div>
      <div className="mb-3">
        <label htmlFor="password" className="mb-1 block text-sm text-slate-300">Password</label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(event) => onChangeField("password", event.target.value)}
          required
          minLength={6}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
        />
      </div>
      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      <button type="submit" disabled={loading} className="glow-button mb-2 w-full rounded-xl border border-fuchsia-400/60 px-4 py-2 font-medium text-fuchsia-100 transition hover:scale-[1.01] disabled:opacity-60">
        {loading ? "Please wait..." : mode === "login" ? "Login" : "Register + Login"}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setError("");
          setMode((prev) => (prev === "login" ? "register" : "login"));
        }}
        className="w-full rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:scale-[1.01] hover:border-slate-500 disabled:opacity-60"
      >
        {mode === "login" ? "Need an account? Register" : "Have an account? Login"}
      </button>
    </form>
  );
}
