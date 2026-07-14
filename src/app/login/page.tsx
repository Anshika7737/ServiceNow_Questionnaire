"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  AuthButton,
  AuthError,
  AuthField,
  AuthInput,
  AuthShell,
} from "@/components/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }

      const dashboardMap: Record<string, string> = {
        ADMIN: "/dashboard/admin",
        MANAGER: "/dashboard/manager",
        USER: "/dashboard/user",
      };

      router.push(dashboardMap[data.user.role] || "/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your exam prep"
      footer={
        <span className="text-[var(--text-muted)]">
          Invite-only platform. Contact your admin for access.
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError message={error} />}

        <AuthField label="Email" id="email">
          <AuthInput
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </AuthField>

        <AuthField label="Password" id="password">
          <div className="relative">
            <AuthInput
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setPassword(e.clipboardData.getData("text").trim());
              }}
              placeholder="Your password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </AuthField>

        <AuthButton loading={loading} loadingText="Logging in...">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
