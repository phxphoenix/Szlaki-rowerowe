import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent-primary)] text-white shadow-sm hover:bg-[var(--accent-primary-hover)] active:scale-[0.99]",
        carbon:
          "bg-[var(--bg-carbon)] text-[var(--text-on-dark)] border border-white/10 hover:bg-[var(--bg-carbon-elevated)]",
        secondary:
          "bg-[var(--bg-surface-muted)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)]",
        outline:
          "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]",
        ghost:
          "bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]",
        destructive:
          "bg-[var(--accent-danger)] text-white shadow-sm hover:opacity-90",
      },
      size: {
        default: "min-h-[44px] px-4 py-2 text-sm",
        sm: "min-h-[44px] sm:min-h-[38px] px-3.5 py-2 text-sm",
        lg: "min-h-[48px] px-6 py-3 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
