import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "draft" | "generating" | "signed" | "closed" | "ai" | "manual" | "warning" | "default";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  className = "",
}) => {
  const styles = {
    default: "bg-surface-container-high border-outline-variant text-on-surface-variant",
    draft: "bg-surface-container-high border-outline-variant text-on-surface-variant",
    generating: "bg-primary-fixed text-primary border-primary-fixed-dim",
    signed: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
    closed: "bg-tertiary-container text-on-tertiary-container border-outline",
    ai: "bg-primary-container text-on-primary-container border-primary",
    manual: "bg-surface-container text-outline border-outline-variant",
    warning: "bg-secondary-container/30 text-secondary-fixed-variant border-secondary",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
