"use client";

import type { AchievementWithProgress } from "@prostcounter/shared/schemas";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { AchievementBadge } from "./AchievementBadge";
import { AchievementProgress } from "./AchievementProgress";

interface AchievementCardProps {
  achievement: AchievementWithProgress;
  className?: string;
  showProgress?: boolean;
}

export function AchievementCard({
  achievement,
  className,
  showProgress = true,
}: AchievementCardProps) {
  const {
    name,
    description,
    category,
    rarity,
    points,
    icon,
    is_unlocked,
    unlocked_at,
    user_progress,
  } = achievement;

  const categoryLabels = {
    consumption: "Beer Consumption",
    attendance: "Festival Attendance",
    explorer: "Explorer",
    social: "Social",
    competitive: "Competitive",
    special: "Special",
  };

  return (
    <Card
      className={cn(
        "relative transition-all duration-200 hover:shadow-md",
        is_unlocked
          ? "border-green-200 bg-green-50/30"
          : "border-gray-200 bg-white hover:bg-gray-50/50",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle
              className={cn(
                "text-lg font-semibold leading-tight",
                is_unlocked ? "text-green-800" : "text-gray-700",
              )}
            >
              {name}
            </CardTitle>
            <CardDescription className="mt-1 text-sm">
              {description}
            </CardDescription>
          </div>

          <div className="flex flex-col items-end gap-2">
            <AchievementBadge
              name=""
              icon={icon}
              rarity={rarity}
              points={points}
              isUnlocked={is_unlocked}
              size="sm"
              className="shrink-0"
            />

            <Badge variant="outline" className="text-xs">
              {categoryLabels[category]}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Points:{" "}
              <span className="font-medium text-gray-900">{points}</span>
            </span>
            <span
              className={cn(
                "font-medium capitalize",
                rarity === "common" && "text-gray-600",
                rarity === "rare" && "text-blue-600",
                rarity === "epic" && "text-purple-600",
                rarity === "legendary" && "text-yellow-600",
              )}
            >
              {rarity}
            </span>
          </div>

          {user_progress && showProgress && (
            <div className="space-y-3">
              <AchievementProgress progress={user_progress} />

              {is_unlocked && unlocked_at && (
                <div className="rounded-lg border border-green-200 bg-green-100 p-2">
                  <div className="flex items-center gap-2 text-sm text-green-800">
                    <span className="text-base">✅</span>
                    <span className="font-medium">Completed!</span>
                  </div>
                  <div className="mt-1 text-xs text-green-600">
                    {new Date(unlocked_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
