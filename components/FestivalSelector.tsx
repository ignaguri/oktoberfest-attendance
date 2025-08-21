"use client";

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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";

import type { Festival } from "@/lib/types";

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

const getFestivalStatus = (festival: Festival) => {
  const now = new Date();
  const startDate = new Date(festival.start_date);
  const endDate = new Date(festival.end_date);

  if (now < startDate) {
    return { status: "upcoming", color: "text-blue-600" };
  } else if (now >= startDate && now <= endDate) {
    return { status: "active", color: "text-green-600" };
  } else {
    return { status: "ended", color: "text-gray-500" };
  }
};

export function FestivalSelector({ className }: FestivalSelectorProps) {
  const { currentFestival, festivals, setCurrentFestival, isLoading } =
    useFestival();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center animate-pulse">
        <span className="text-sm font-medium text-gray-600">...</span>
      </div>
    );
  }

  if (!currentFestival) {
    return (
      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
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
          "h-10 w-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-semibold",
          className,
        )}
      >
        <span className="text-sm">
          {firstLetter}
          <sub className="text-xs">{lastTwoDigits}</sub>
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
            "h-10 w-10 rounded-full bg-yellow-500 hover:bg-yellow-400 text-white font-semibold p-0 transition-colors",
            className,
          )}
        >
          <span className="text-sm">
            {firstLetter}
            <sub className="text-xs">{lastTwoDigits}</sub>
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
            const { status, color } = getFestivalStatus(festival);
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
                      "h-10 w-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0",
                      isSelected
                        ? "bg-white text-yellow-600"
                        : "bg-yellow-500 text-white",
                    )}
                  >
                    <span className="text-sm">
                      {fLetter}
                      <sub className="text-xs">{lDigits}</sub>
                    </span>
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{festival.name}</span>
                      <span className={`text-xs capitalize ${color}`}>
                        {status}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(festival.start_date), "MMM d")} -{" "}
                      {format(new Date(festival.end_date), "MMM d, yyyy")}
                    </span>
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
