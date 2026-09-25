import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "light" | "outlineLight";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover border-transparent",
  secondary: "bg-canvas text-ink border-line hover:bg-canvas-subtle",
  outline: "bg-surface text-ink border-line-strong hover:bg-canvas-subtle",
  ghost: "bg-transparent text-ink-secondary border-transparent hover:bg-canvas",
  danger: "bg-danger text-white hover:bg-danger-hover border-transparent",
  light: "bg-white text-primary-dark border-transparent hover:bg-primary-subtle",
  outlineLight: "bg-transparent text-white border-white/30 hover:bg-white/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-11 px-5 text-[14px]",
};

/** Shared class builder so links can look like buttons without nesting interactive elements. */
export function buttonStyles(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={buttonStyles(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
