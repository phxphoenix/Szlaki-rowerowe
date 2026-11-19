import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent-primary)] text-white",
        carbon:
          "bg-[#11161A]/85 text-[#F8FAF7] backdrop-blur-md border border-white/15",
        secondary:
          "bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]",
        outline:
          "border border-[var(--border-subtle)] text-[var(--text-secondary)] bg-transparent",
        easy: "bg-[#16A34A] text-white shadow-sm",
        moderate: "bg-[#D97706] text-white shadow-sm",
        hard: "bg-[#E11D48] text-white shadow-sm",
        telemetry:
          "bg-[var(--accent-telemetry)]/15 text-[var(--accent-telemetry)] border border-[var(--accent-telemetry)]/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
