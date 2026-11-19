"use client";

import { useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Globe,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ImportedTrailMetadata } from "@/lib/importer/scraper";

export interface UrlImporterCardProps {
  onImport: (metadata: ImportedTrailMetadata) => void;
}

function summarizeImportedFields(data: ImportedTrailMetadata): string[] {
  const fields: string[] = [];
  if (data.title) fields.push("tytuł");
  if (data.shortDescription) fields.push("krótki opis");
  if (data.content) fields.push("treść opisu");
  if (data.region) fields.push("województwo");
  if (data.distanceKm) fields.push(`dystans (${data.distanceKm} km)`);
  if (data.elevationGainM) fields.push(`przewyższenie (${data.elevationGainM} m)`);
  if (data.coverImageUrl) fields.push("zdjęcie okładkowe");
  if (data.imageUrls.length > 1) {
    fields.push(`galeria (${data.imageUrls.length} zdjęć)`);
  }
  if (data.gpxUrl) fields.push("link do pliku GPX");
  if (data.sourceName) fields.push(`źródło (${data.sourceName})`);
  return fields;
}

export function UrlImporterCard({ onImport }: UrlImporterCardProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<string | null>(null);

  async function handleImport() {
    const trimmed = url.trim();
    setErrorMessage(null);
    setSuccessSummary(null);

    if (!trimmed) {
      setErrorMessage("Wklej adres URL strony ze szlakiem (np. z portalu slaskie.travel).");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/import-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmed }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (ImportedTrailMetadata & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(
          payload?.error ??
            "Nie udało się pobrać danych ze wskazanej strony. Uzupełnij pola ręcznie.",
        );
        return;
      }

      if (!payload || !("sourceUrl" in payload)) {
        setErrorMessage("Serwer zwrócił nieoczekiwany format odpowiedzi.");
        return;
      }

      onImport(payload);
      const fields = summarizeImportedFields(payload);
      setSuccessSummary(
        fields.length > 0
          ? `Pobrano ze strony: ${fields.join(", ")}. Możesz teraz dopracować szczegóły poniżej.`
          : "Połączono ze stroną i zapisano link źródłowy. Uzupełnij brakujące pola ręcznie.",
      );
    } catch {
      setErrorMessage(
        "Wystąpił błąd połączenia podczas pobierania danych ze strony.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!isLoading) {
        void handleImport();
      }
    }
  }

  return (
    <section
      aria-labelledby="url-importer-heading"
      className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-carbon)] p-5 text-[var(--text-on-dark)] shadow-md sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FF4D1C] via-[#0284C7] to-transparent"
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF4D1C]/20 text-[#FF5E33] ring-1 ring-[#FF4D1C]/40">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FF7A59]">
              Szybki import z internetu
            </p>
            <h2
              id="url-importer-heading"
              className="font-display text-2xl font-bold uppercase tracking-wide text-white"
            >
              Importuj szlak z linku
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              Wklej link do artykułu lub karty szlaku (np.{" "}
              <span className="font-mono text-xs text-white/90">
                slaskie.travel/route/1019753
              </span>
              ), aby automatycznie uzupełnić tytuł, opis, okładkę, województwo i źródło.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label
              htmlFor="import-url-input"
              className="block text-xs font-semibold uppercase tracking-wider text-white/80"
            >
              Adres URL strony ze szlakiem
            </label>
            <div className="relative flex items-center">
              <Globe
                className="pointer-events-none absolute left-3.5 h-4 w-4 text-white/50"
                aria-hidden="true"
              />
              <Input
                id="import-url-input"
                type="url"
                inputMode="url"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="https://slaskie.travel/route/1019753"
                disabled={isLoading}
                className="border-white/15 bg-[var(--bg-carbon-elevated)] pl-10 text-base text-white placeholder:text-white/40 focus:border-[#FF5E33] focus:bg-[var(--bg-carbon-elevated)]"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleImport}
            disabled={isLoading}
            className="min-h-[44px] shrink-0 sm:px-5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Pobieranie...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Pobierz dane ze strony</span>
              </>
            )}
          </Button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successSummary && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
              aria-hidden="true"
            />
            <span>{successSummary}</span>
          </div>
        )}
      </div>
    </section>
  );
}
