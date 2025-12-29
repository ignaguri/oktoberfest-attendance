import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

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
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className,
      )}
    >
      <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-gray-50 border-2 border-gray-200">
        <Icon className="w-8 h-8 text-gray-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-6 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="yellow">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
