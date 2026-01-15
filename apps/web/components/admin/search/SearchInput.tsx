"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, X, Loader2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useState } from "react";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  isLoading?: boolean;
  debounceMs?: number;
  className?: string;
  showClearButton?: boolean;
  showSearchIcon?: boolean;
  disabled?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = "Search...",
      isLoading = false,
      debounceMs = 300,
      className,
      showClearButton = true,
      showSearchIcon = true,
      disabled = false,
    },
    ref,
  ) => {
    const [localValue, setLocalValue] = useState(value);

    // Debounce the input value
    useEffect(() => {
      const timer = setTimeout(() => {
        if (localValue !== value) {
          onChange(localValue);
        }
      }, debounceMs);

      return () => clearTimeout(timer);
    }, [localValue, onChange, debounceMs, value]);

    // Sync external value changes
    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleClear = useCallback(() => {
      setLocalValue("");
      onChange("");
      onClear?.();
    }, [onChange, onClear]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
      },
      [],
    );

    return (
      <div className={cn("relative", className)}>
        {showSearchIcon && (
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        )}
        <Input
          ref={ref}
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            showSearchIcon && "pl-10",
            showClearButton && localValue && "pr-10",
          )}
        />
        {isLoading && (
          <Loader2 className="text-muted-foreground absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
        )}
        {showClearButton && localValue && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="hover:bg-muted absolute right-1 top-1/2 -translate-y-1/2 p-0"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";
