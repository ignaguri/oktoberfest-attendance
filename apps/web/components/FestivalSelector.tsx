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

import type { BadgeVariants } from "@/components/ui/badge";
import type { Festival, FestivalStatus } from "@/lib/types";

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
): { status: FestivalStatus; variant: BadgeVariants } => {
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
      <div className="h-10 w-10 rounded-md bg-gray-300 flex items-center justify-center animate-pulse">
        <span className="text-sm font-medium text-gray-600">...</span>
      </div>
    );
  }

  if (!currentFestival) {
    return (
      <div className="h-10 w-10 rounded-md bg-gray-300 flex items-center justify-center">
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
          "h-10 rounded-md bg-yellow-600 flex items-center justify-center text-white font-semibold",
          "w-10 sm:w-auto sm:px-3 sm:gap-2",
          className,
        )}
      >
        <span className="text-base sm:hidden">
          {firstLetter}
          <sub className="text-sm">{lastTwoDigits}</sub>
        </span>
        <span className="hidden sm:block text-sm font-medium">
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
            "h-10 rounded-md bg-yellow-600 hover:bg-yellow-400 text-white font-semibold transition-colors",
            "w-10 sm:w-auto sm:px-3 sm:gap-2",
            className,
          )}
        >
          <span className="text-base sm:hidden">
            {firstLetter}
            <sub className="text-sm">{lastTwoDigits}</sub>
          </span>
          <span className="hidden sm:block text-sm font-medium">
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
        <div className="grid gap-3 max-h-96 overflow-y-auto">
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
                  "justify-start h-auto p-4 w-full",
                  isSelected &&
                    "bg-yellow-500 hover:bg-yellow-600 border-yellow-500",
                )}
                onClick={() => {
                  setCurrentFestival(festival);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-3 w-full">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-md flex items-center justify-center font-semibold flex-shrink-0",
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
                    <span className="text-xs text-muted-foreground">
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
