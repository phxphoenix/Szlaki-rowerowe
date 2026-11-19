import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative flex w-full items-center">
        <select
          ref={ref}
          className={cn(
            "min-h-[44px] w-full appearance-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] py-2 pr-10 pl-3.5 text-base font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--text-secondary)]/50 focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 h-4 w-4 text-[var(--text-secondary)]"
          aria-hidden="true"
        />
      </div>
    );
  },
);

Select.displayName = "Select";
