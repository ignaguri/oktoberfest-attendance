import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-50">
        <Icon className="h-8 w-8 text-gray-600" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-gray-600">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="yellow">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
