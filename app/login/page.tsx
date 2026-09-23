"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconSparkles, IconLock, IconMail, IconUser, IconArrowRight } from "../components/Icons";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload = mode === "register" ? { name, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 440,
        background: "var(--card-bg)",
        border: "1px solid var(--line)",
        borderRadius: 28,
        padding: 32,
        boxShadow: "var(--shadow-lg)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            display: "grid",
            width: 52,
            height: 52,
            placeItems: "center",
            margin: "0 auto 12px",
            borderRadius: 16,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#ffffff",
            boxShadow: "0 8px 24px rgba(99, 102, 241, 0.4)",
          }}
        >
          <IconSparkles size={28} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>
          {mode === "login" ? "Welcome back to LifeOS" : "Create your LifeOS account"}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          {mode === "login" ? "Log in to access your personal command center." : "Store your records, schedule, tasks, & budget securely."}
        </p>
      </div>

      {/* Mode Toggle Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          background: "var(--subtle-bg)",
          padding: 4,
          borderRadius: 14,
          marginBottom: 24,
          border: "1px solid var(--line)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setErrorMessage("");
          }}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: 0,
            cursor: "pointer",
            background: mode === "login" ? "var(--paper)" : "transparent",
            color: mode === "login" ? "var(--brand)" : "var(--muted)",
            boxShadow: mode === "login" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
            transition: "all 160ms ease",
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setErrorMessage("");
          }}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: 0,
            cursor: "pointer",
            background: mode === "register" ? "var(--paper)" : "transparent",
            color: mode === "register" ? "var(--brand)" : "var(--muted)",
            boxShadow: mode === "register" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
            transition: "all 160ms ease",
          }}
        >
          Register
        </button>
      </div>

      {/* Direct Google Sign In */}
      <a
        href="/api/auth/google"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "100%",
          padding: "12px 16px",
          marginBottom: 18,
          background: "#ffffff",
          color: "#0f172a",
          borderRadius: 14,
          border: "1px solid #cbd5e1",
          textDecoration: "none",
          fontWeight: 700,
          fontSize: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          transition: "all 160ms ease",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Sign in with Google & Sync Calendar</span>
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--line)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>or sign in with email</span>
        <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--line)" }} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {mode === "register" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Full Name</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: 12, color: "var(--muted)" }}>
                <IconUser size={18} />
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Suhas Reddy"
                style={{
                  width: "100%",
                  padding: "11px 14px 11px 42px",
                  borderRadius: 12,
                  border: "1px solid var(--input-border)",
                  background: "var(--input-bg)",
                  color: "var(--ink)",
                  fontSize: 14,
                  outline: 0,
                }}
              />
            </div>
          </label>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Email Address</span>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: 12, color: "var(--muted)" }}>
              <IconMail size={18} />
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="suhas@example.com"
              style={{
                width: "100%",
                padding: "11px 14px 11px 42px",
                borderRadius: 12,
                border: "1px solid var(--input-border)",
                background: "var(--input-bg)",
                color: "var(--ink)",
                fontSize: 14,
                outline: 0,
              }}
            />
          </div>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Password</span>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: 12, color: "var(--muted)" }}>
              <IconLock size={18} />
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "11px 14px 11px 42px",
                borderRadius: 12,
                border: "1px solid var(--input-border)",
                background: "var(--input-bg)",
                color: "var(--ink)",
                fontSize: 14,
                outline: 0,
              }}
            />
          </div>
        </label>

        {errorMessage && (
          <p
            style={{
              margin: 0,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          className="primary-button"
          disabled={isLoading}
          style={{ width: "100%", padding: "13px", marginTop: 8, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
        >
          <span>{isLoading ? "Authenticating..." : mode === "login" ? "Sign In to LifeOS" : "Create Account"}</span>
          <IconArrowRight size={16} />
        </button>
      </form>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <Link href="/" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
          ← Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="app-shell" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
      <Suspense fallback={<div style={{ color: "var(--muted)", padding: 40 }}>Loading authentication...</div>}>
        <LoginFormContent />
      </Suspense>
    </main>
  );
}
