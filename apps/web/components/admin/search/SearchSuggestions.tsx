"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Search, Clock, TrendingUp } from "lucide-react";
import { useState, useCallback, useMemo } from "react";

import type { ReactNode } from "react";

export interface SearchSuggestion {
  id: string;
  text: string;
  type?: "recent" | "popular" | "suggestion";
  icon?: ReactNode;
  onClick?: () => void;
}

export interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  onClearHistory?: () => void;
  className?: string;
  maxSuggestions?: number;
  showRecent?: boolean;
  showPopular?: boolean;
  showSuggestions?: boolean;
}

export function SearchSuggestions({
  suggestions,
  onSuggestionSelect,
  onClearHistory,
  className,
  maxSuggestions = 10,
  showRecent: _showRecent = true,
  showPopular: _showPopular = true,
  showSuggestions: _showSuggestions = true,
}: SearchSuggestionsProps) {
  const [open, setOpen] = useState(false);

  const filteredSuggestions = useMemo(() => {
    const recent = suggestions.filter((s) => s.type === "recent").slice(0, 5);
    const popular = suggestions.filter((s) => s.type === "popular").slice(0, 3);
    const other = suggestions
      .filter((s) => !s.type || s.type === "suggestion")
      .slice(0, 2);

    return [...recent, ...popular, ...other].slice(0, maxSuggestions);
  }, [suggestions, maxSuggestions]);

  const handleSuggestionClick = useCallback(
    (suggestion: SearchSuggestion) => {
      onSuggestionSelect(suggestion);
      setOpen(false);
    },
    [onSuggestionSelect],
  );

  const getSuggestionIcon = (type?: string) => {
    switch (type) {
      case "recent":
        return <Clock className="size-4" />;
      case "popular":
        return <TrendingUp className="size-4" />;
      default:
        return <Search className="size-4" />;
    }
  };

  const getGroupTitle = (type: string) => {
    switch (type) {
      case "recent":
        return "Recent Searches";
      case "popular":
        return "Popular Searches";
      default:
        return "Suggestions";
    }
  };

  const groupedSuggestions = filteredSuggestions.reduce(
    (acc, suggestion) => {
      const type = suggestion.type || "suggestion";
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(suggestion);
      return acc;
    },
    {} as Record<string, SearchSuggestion[]>,
  );

  if (filteredSuggestions.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 px-2", className)}
          title="View search suggestions and history"
        >
          <Search className="mr-1 size-4" />
          Suggestions
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandList>
            {Object.entries(groupedSuggestions).map(
              ([type, groupSuggestions]) => (
                <CommandGroup key={type} heading={getGroupTitle(type)}>
                  {groupSuggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.id}
                      onSelect={() => handleSuggestionClick(suggestion)}
                      className="flex items-center gap-2"
                    >
                      {getSuggestionIcon(suggestion.type)}
                      <span className="flex-1">{suggestion.text}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ),
            )}
            {onClearHistory && (
              <CommandGroup>
                <CommandItem
                  onSelect={onClearHistory}
                  className="text-muted-foreground"
                >
                  Clear History
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
