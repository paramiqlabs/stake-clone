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
    <form onSubmit={onSubmit}>
      <h1>{mode === "login" ? "Login" : "Register"}</h1>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => onChangeField("email", event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(event) => onChangeField("password", event.target.value)}
          required
          minLength={6}
        />
      </div>
      {error ? <p>{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? "Please wait..." : mode === "login" ? "Login" : "Register + Login"}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setError("");
          setMode((prev) => (prev === "login" ? "register" : "login"));
        }}
      >
        {mode === "login" ? "Need an account? Register" : "Have an account? Login"}
      </button>
    </form>
  );
}

