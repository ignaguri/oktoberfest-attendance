"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFestival } from "@/contexts/FestivalContext";
import { format } from "date-fns";
import { ChevronDown, Calendar } from "lucide-react";

import type { Festival } from "@/lib/types";

interface FestivalSelectorProps {
  className?: string;
}

export function FestivalSelector({ className }: FestivalSelectorProps) {
  const { currentFestival, festivals, setCurrentFestival, isLoading } =
    useFestival();

  if (isLoading) {
    return (
      <Button variant="outline" disabled className={className}>
        <Calendar className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  if (!currentFestival || festivals.length === 0) {
    return null;
  }

  const handleFestivalSelect = (festival: Festival) => {
    setCurrentFestival(festival);
  };

  const getFestivalDisplayName = (festival: Festival) => {
    const startYear = new Date(festival.start_date).getFullYear();
    return `${festival.name} (${startYear})`;
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

  // Only show selector if there are multiple festivals
  if (festivals.length <= 1) {
    return (
      <div
        className={`flex items-center text-sm text-gray-600 ${className || ""}`}
      >
        <Calendar className="mr-2 h-4 w-4" />
        {getFestivalDisplayName(currentFestival)}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <Calendar className="mr-2 h-4 w-4" />
          {getFestivalDisplayName(currentFestival)}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {festivals.map((festival) => {
          const isSelected = festival.id === currentFestival.id;
          const { status, color } = getFestivalStatus(festival);

          return (
            <DropdownMenuItem
              key={festival.id}
              onClick={() => handleFestivalSelect(festival)}
              className={`flex flex-col items-start space-y-1 ${isSelected ? "bg-accent" : ""}`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`font-medium ${isSelected ? "text-accent-foreground" : ""}`}
                >
                  {getFestivalDisplayName(festival)}
                </span>
                <span className={`text-xs capitalize ${color}`}>{status}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(festival.start_date), "MMM d")} -{" "}
                {format(new Date(festival.end_date), "MMM d, yyyy")}
              </div>
              <div className="text-xs text-muted-foreground">
                {festival.location}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
