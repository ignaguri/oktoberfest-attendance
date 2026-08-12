"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { toast } from "sonner";

import type { AchievementTier, PersistedUnlock } from "@prostcounter/shared/achievements";
import { batchEarnsConfetti, nameKeyFor, tierToRarity } from "@prostcounter/shared/achievements";
import { useUnlockQueue } from "@prostcounter/shared/hooks";

import { useConfetti } from "@/hooks/useConfetti";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { AchievementBadge } from "./AchievementBadge";

/** Beyond this a stacked toast would overflow — the rest still counted in the title. */
const MAX_TOAST_BADGES = 3;
const TOAST_DURATION_MS = 8000;
const CONFETTI_DURATION_MS = 4000;

function unlockDestination(batch: PersistedUnlock[]): string {
  if (batch.length !== 1) {
    return "/achievements";
  }
  return `/achievements?highlight=${encodeURIComponent(batch[0].slug)}`;
}

interface UnlockToastBodyProps {
  batch: PersistedUnlock[];
  onNavigate: () => void;
}

function UnlockToastBody({ batch, onNavigate }: UnlockToastBodyProps) {
  const { t } = useTranslation();
  const isSingle = batch.length === 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNavigate();
        }
      }}
      className={cn(
        "flex w-full max-w-sm cursor-pointer flex-col gap-2 rounded-lg border bg-background p-4 text-left shadow-lg",
      )}
    >
      <p className="font-semibold text-foreground">
        {isSingle
          ? t("achievements.unlock.single")
          : t("achievements.unlock.multiple", { count: batch.length })}
      </p>

      {isSingle && (
        <>
          <p className="text-sm text-muted-foreground">{t(nameKeyFor(batch[0].slug))}</p>
          <p className="text-xs text-muted-foreground">
            {t("achievements.unlock.points", { points: batch[0].points })}
          </p>
        </>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {batch.slice(0, MAX_TOAST_BADGES).map((entry) => (
            <AchievementBadge
              key={entry.eventId}
              name=""
              icon={entry.glyph}
              category={entry.category}
              tier={entry.tier as AchievementTier}
              rarity={tierToRarity(entry.tier)}
              points={entry.points}
              isUnlocked
              size="sm"
            />
          ))}
        </div>
        <span className="text-xs font-medium text-primary">
          {t("achievements.unlock.viewAction")}
        </span>
      </div>
    </div>
  );
}

/**
 * Watches the shared unlock queue and fires one stacked toast per batch,
 * with confetti when the batch's best rung is gold or platinum.
 *
 * Renders nothing of its own besides the confetti overlay: the toast body
 * itself is handed to sonner via `toast.custom`, which portals it outside
 * this component's subtree.
 */
export function UnlockToastHost() {
  const router = useRouter();
  const { batch, consume } = useUnlockQueue();
  const { isExploding, triggerConfetti } = useConfetti();

  useEffect(() => {
    if (batch.length === 0) {
      return;
    }

    const destination = unlockDestination(batch);

    toast.custom(
      (id) => (
        <UnlockToastBody
          batch={batch}
          onNavigate={() => {
            toast.dismiss(id);
            router.push(destination);
          }}
        />
      ),
      { duration: TOAST_DURATION_MS },
    );

    if (batchEarnsConfetti(batch)) {
      triggerConfetti();
    }

    consume();
  }, [batch, consume, triggerConfetti, router]);

  return isExploding ? (
    <div className="pointer-events-none fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
      <ConfettiExplosion
        force={0.4}
        duration={CONFETTI_DURATION_MS}
        particleCount={30}
        width={400}
      />
    </div>
  ) : null;
}
