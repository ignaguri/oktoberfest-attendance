"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFestival } from "@/contexts/FestivalContext";
import { getFestivalStatus } from "@/lib/festivalConstants";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useState } from "react";

import type { Festival, FestivalStatus } from "@/lib/types";
import type { ShadcnBadgeVariant } from "@/lib/ui-adapters";

interface FestivalSelectorProps {
  className?: string;
}

const getFestivalDisplayInfo = (festival: Festival) => {
  const firstLetter = festival.name.charAt(0).toUpperCase();
  // Extract year from the name (assuming format like "Oktoberfest 2024")
  const yearMatch = festival.name.match(/(\d{4})/);
  const lastTwoDigits = yearMatch ? yearMatch[1].slice(-2) : "??";
  return { firstLetter, lastTwoDigits };
};

const getFestivalStatusBadgeProps = (
  festival: Festival,
): { status: FestivalStatus; variant: ShadcnBadgeVariant } => {
  const status = getFestivalStatus(festival);

  if (status === "upcoming") {
    return { status, variant: "default" };
  } else if (status === "active") {
    return { status, variant: "success" };
  } else {
    return { status, variant: "secondary" };
  }
};

export function FestivalSelector({ className }: FestivalSelectorProps) {
  const { currentFestival, festivals, setCurrentFestival, isLoading } =
    useFestival();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-md bg-gray-300">
        <span className="text-sm font-medium text-gray-600">...</span>
      </div>
    );
  }

  if (!currentFestival) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-300">
        <span className="text-sm font-medium text-gray-600">?</span>
      </div>
    );
  }

  // If there's only one festival, show it without the dialog
  if (festivals.length <= 1) {
    const { firstLetter, lastTwoDigits } =
      getFestivalDisplayInfo(currentFestival);
    return (
      <div
        className={cn(
          "flex h-10 items-center justify-center rounded-md bg-yellow-600 font-semibold text-white",
          "w-10 sm:w-auto sm:gap-2 sm:px-3",
          className,
        )}
      >
        <span className="text-base sm:hidden">
          {firstLetter}
          <sub className="text-sm">{lastTwoDigits}</sub>
        </span>
        <span className="hidden text-sm font-medium sm:block">
          {currentFestival.name}
        </span>
      </div>
    );
  }

  const { firstLetter, lastTwoDigits } =
    getFestivalDisplayInfo(currentFestival);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-10 rounded-md bg-yellow-600 font-semibold text-white transition-colors hover:bg-yellow-400",
            "w-10 sm:w-auto sm:gap-2 sm:px-3",
            className,
          )}
        >
          <span className="text-base sm:hidden">
            {firstLetter}
            <sub className="text-sm">{lastTwoDigits}</sub>
          </span>
          <span className="hidden text-sm font-medium sm:block">
            {currentFestival.name}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Festival</DialogTitle>
          <DialogDescription>
            Choose which festival you want to view and participate in.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-96 gap-3 overflow-y-auto">
          {festivals.map((festival) => {
            const { firstLetter: fLetter, lastTwoDigits: lDigits } =
              getFestivalDisplayInfo(festival);
            const { status, variant } = getFestivalStatusBadgeProps(festival);
            const isSelected = festival.id === currentFestival?.id;

            return (
              <Button
                key={festival.id}
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "h-auto w-full justify-start p-4",
                  isSelected &&
                    "border-yellow-500 bg-yellow-500 hover:bg-yellow-600",
                )}
                onClick={() => {
                  setCurrentFestival(festival);
                  setIsOpen(false);
                }}
              >
                <div className="flex w-full items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md font-semibold",
                      isSelected
                        ? "bg-white text-yellow-500"
                        : "bg-yellow-500 text-white",
                    )}
                  >
                    <span className="text-base">
                      {fLetter}
                      <sub className="text-sm">{lDigits}</sub>
                    </span>
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{festival.name}</span>
                      <Badge className="capitalize" variant={variant}>
                        {status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {format(parseISO(festival.start_date), "MMM d")} -{" "}
                      {format(parseISO(festival.end_date), "MMM d, yyyy")}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {festival.location}
                    </span>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
