"use client";

import { ArrowUpDown } from "lucide-react";
import { Select } from "@/components/ui/select";
import { SORT_OPTIONS, type SortOption } from "@/lib/constants/regions";
import { cn } from "@/lib/utils/cn";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Najnowsze",
  distance_asc: "Najkrótsze",
  distance_desc: "Najdłuższe",
  elevation_desc: "Największe przewyższenie",
  difficulty_asc: "Od najłatwiejszych",
};

export interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
}

export function SortSelect({ value, onChange, className }: SortSelectProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <label htmlFor="trail-sort-select" className="sr-only">
        Sortuj szlaki
      </label>
      <ArrowUpDown
        className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-[var(--text-secondary)]"
        aria-hidden="true"
      />
      <Select
        id="trail-sort-select"
        aria-label="Sortuj szlaki"
        value={value}
        onChange={(event) => onChange(event.target.value as SortOption)}
        className="pl-9"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </Select>
    </div>
  );
}
