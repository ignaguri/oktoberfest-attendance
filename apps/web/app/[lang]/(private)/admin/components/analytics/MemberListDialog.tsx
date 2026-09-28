"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsMember } from "@prostcounter/shared/schemas";
import { Link } from "next-view-transitions";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";

export interface MemberListChip {
  value: string;
  label: string;
}

interface MemberListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the list is, e.g. "Photos · Used it". */
  label: string;
  /** The dashboard number the list adds up to. */
  count: number;
  chips?: readonly MemberListChip[];
  selectedChip?: string;
  onChipChange?: (value: string) => void;
  members: readonly AnalyticsMember[];
  truncated: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** Pooled scorecard: label each row with its festival. */
  showFestival?: boolean;
}

export default function MemberListDialog({
  open,
  onOpenChange,
  label,
  count,
  chips,
  selectedChip,
  onChipChange,
  members,
  truncated,
  isLoading,
  error,
  onRetry,
  showFestival = false,
}: MemberListDialogProps) {
  const { t } = useTranslation();

  let body;
  if (error) {
    body = (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <span>{t("admin.analytics.loadError")}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("admin.analytics.retry")}
        </Button>
      </div>
    );
  } else if (isLoading) {
    body = <p className="text-sm text-muted-foreground">{t("admin.analytics.members.loading")}</p>;
  } else if (members.length === 0) {
    body = <p className="text-sm text-muted-foreground">{t("admin.analytics.members.empty")}</p>;
  } else {
    body = (
      <ul className="flex max-h-[60vh] flex-col divide-y overflow-y-auto">
        {members.map((member) => {
          const details = [
            member.signedUpAt
              ? t("admin.analytics.members.signedUp", { date: member.signedUpAt.slice(0, 10) })
              : null,
            member.lastActiveDay
              ? t("admin.analytics.members.lastActive", { date: member.lastActiveDay })
              : t("admin.analytics.members.neverActive"),
            showFestival ? (member.festivalName ?? null) : null,
          ].filter((detail): detail is string => detail !== null);
          return (
            <li key={`${member.userId}-${member.festivalId ?? ""}`}>
              <Link
                href={`/admin/users/${member.userId}`}
                className="flex flex-col rounded px-2 py-2 text-left hover:bg-muted"
                title={t("admin.analytics.members.openHint")}
              >
                <span className="text-sm font-medium">
                  {member.fullName ?? member.username ?? t("admin.analytics.members.noName")}
                  {member.username && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      @{member.username}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{details.join(" · ")}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.analytics.members.title", { label, count })}
      description={t("admin.analytics.members.dialogHint")}
    >
      <div className="flex flex-col gap-3">
        {chips && chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Button
                key={chip.value}
                size="sm"
                variant={chip.value === selectedChip ? "default" : "outline"}
                onClick={() => onChipChange?.(chip.value)}
              >
                {chip.label}
              </Button>
            ))}
          </div>
        )}
        {truncated && (
          <p className="text-xs text-muted-foreground">
            {t("admin.analytics.members.truncated", { count: members.length })}
          </p>
        )}
        {body}
      </div>
    </ResponsiveDialog>
  );
}
