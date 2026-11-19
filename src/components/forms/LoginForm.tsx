"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sanitizeNextPath } from "@/lib/auth/redirect";

export interface LoginFormProps {
  nextPath: string;
  authConfigured: boolean;
}

export function LoginForm({ nextPath, authConfigured }: LoginFormProps) {
  const router = useRouter();
  const safeNext = sanitizeNextPath(nextPath, "/dodaj");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password.trim().length === 0) {
      setErrorMessage("Podaj hasło administratora.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = (await response.json().catch(() => null)) as {
        authenticated?: boolean;
        error?: string;
      } | null;

      if (!response.ok) {
        if (response.status === 401) {
          setErrorMessage(
            data?.error ?? "Nieprawidłowe hasło administratora. Spróbuj ponownie.",
          );
        } else if (response.status === 503) {
          setErrorMessage(
            data?.error ??
              "Autoryzacja nie jest skonfigurowana na serwerze (brak zmiennej ADMIN_PASSWORD).",
          );
        } else {
          setErrorMessage(
            data?.error ?? "Nie udało się zalogować. Spróbuj ponownie za chwilę.",
          );
        }
        return;
      }

      router.push(safeNext);
      router.refresh();
    } catch {
      setErrorMessage(
        "Wystąpił błąd sieci podczas logowania. Sprawdź połączenie i spróbuj ponownie.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {!authConfigured && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-[var(--accent-warning)]/40 bg-[var(--accent-warning)]/10 p-4 text-sm text-[var(--text-primary)]"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-warning)]"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-semibold">Brak konfiguracji hasła na serwerze</p>
            <p className="text-[var(--text-secondary)]">
              Ustaw zmienną środowiskową{" "}
              <code className="rounded bg-[var(--bg-surface-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-primary)]">
                ADMIN_PASSWORD
              </code>{" "}
              w pliku <code className="font-mono text-xs">.env.local</code> lub w ustawieniach Vercel.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          data-testid="login-error"
          className="flex items-start gap-3 rounded-2xl border border-[var(--accent-danger)]/40 bg-[var(--accent-danger)]/10 p-4 text-sm font-medium text-[var(--accent-danger)]"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="admin-password"
          className="block text-sm font-semibold text-[var(--text-primary)]"
        >
          Hasło administratora
        </label>
        <div className="relative flex items-center">
          <Lock
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--text-secondary)]"
            aria-hidden="true"
          />
          <Input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Wpisz hasło panelu..."
            autoComplete="current-password"
            required
            disabled={isSubmitting}
            aria-invalid={Boolean(errorMessage)}
            className="pr-12 pl-10 text-base"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            className="absolute right-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Sesja jest zapisywana w bezpiecznym ciasteczku HTTP-only i wygasa automatycznie po 7 dniach.
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full min-h-[48px] text-base font-bold"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Logowanie...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span>Zaloguj do panelu</span>
          </>
        )}
      </Button>
    </form>
  );
}
