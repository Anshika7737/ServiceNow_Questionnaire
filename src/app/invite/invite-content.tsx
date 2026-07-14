"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import {
  AuthButton,
  AuthError,
  AuthField,
  AuthInput,
  AuthLink,
  AuthNotice,
  AuthShell,
} from "@/components/auth-shell";

export default function InvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(true);
  const [accountCreated, setAccountCreated] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{
    role: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    if (!inviteToken) {
      router.replace("/login");
      return;
    }

    fetch(`/api/invites/validate?token=${inviteToken}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.invite) {
          setInviteInfo(data.invite);
          setEmail(data.invite.email);
        } else {
          setError("This invite link is invalid or has expired.");
        }
      })
      .catch(() => setError("Could not validate invite link."))
      .finally(() => setValidating(false));
  }, [inviteToken, router]);

  const passwordRules = [
    { label: "At least 8 characters", met: password.length >= 8 },
  ];
  const allPasswordRulesMet = passwordRules.every((rule) => rule.met);
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          inviteToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed.");
        return;
      }

      setAccountCreated(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
        Validating invite...
      </div>
    );
  }

  if (!inviteInfo) {
    return (
      <AuthShell
        title="Invalid invite"
        subtitle="This link is no longer valid."
        footer={<AuthLink href="/login">Log in</AuthLink>}
      >
        {error && <AuthError message={error} />}
      </AuthShell>
    );
  }

  if (accountCreated) {
    return (
      <AuthShell
        title="Account created"
        subtitle="Your account is ready. Log in with the password you just set."
      >
        <AuthLink href="/login">
          <span className="flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]">
            Log in
          </span>
        </AuthLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Accept your invite"
      subtitle="Set up your account to join the platform."
    >
      <AuthNotice>
        Invited as{" "}
        <span className="font-medium text-[var(--text)]">
          {ROLE_LABELS[inviteInfo.role as keyof typeof ROLE_LABELS]}
        </span>
      </AuthNotice>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError message={error} />}

        <AuthField label="Full name" id="name">
          <AuthInput
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
          />
        </AuthField>

        <AuthField label="Email" id="email">
          <AuthInput
            id="email"
            type="email"
            required
            value={email}
            readOnly
          />
        </AuthField>

        <AuthField label="Password" id="password">
          <div className="relative">
            <AuthInput
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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
          {password.length > 0 && (
            <ul className="mt-2 space-y-1">
              {passwordRules.map((rule) => (
                <li
                  key={rule.label}
                  className={`flex items-center gap-1.5 text-xs ${
                    rule.met
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {rule.met ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  )}
                  {rule.label}
                </li>
              ))}
            </ul>
          )}
        </AuthField>

        <AuthField label="Confirm password" id="confirmPassword">
          <AuthInput
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
          />
          {confirmPassword.length > 0 && (
            <p
              className={`mt-2 flex items-center gap-1.5 text-xs ${
                passwordsMatch
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {passwordsMatch ? (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  Passwords match
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5 shrink-0" />
                  Passwords do not match
                </>
              )}
            </p>
          )}
        </AuthField>

        <AuthButton
          loading={loading}
          loadingText="Creating account..."
          disabled={!allPasswordRulesMet || !passwordsMatch}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
