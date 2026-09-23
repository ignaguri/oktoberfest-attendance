"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsSectionCardProps {
  title: string;
  description?: string;
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * Shared loading / error / empty handling for every analytics section, so an
 * empty range reads as "no data yet" instead of a wall of zeros.
 */
export default function AnalyticsSectionCard({
  title,
  description,
  isLoading,
  error,
  isEmpty,
  onRetry,
  children,
}: AnalyticsSectionCardProps) {
  const { t } = useTranslation();

  let body: ReactNode = children;
  if (isLoading) {
    body = <Skeleton className="h-40 w-full" />;
  } else if (error) {
    body = (
      <div className="flex items-center gap-3 text-sm text-destructive">
        <span>{t("admin.analytics.loadError")}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("admin.analytics.retry")}
        </Button>
      </div>
    );
  } else if (isEmpty) {
    body = <p className="text-sm text-muted-foreground">{t("admin.analytics.empty")}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
